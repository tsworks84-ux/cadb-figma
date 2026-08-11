import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { sendMail } from "../../utils/mailer.js";
import { getFiscalYear, computeAccrued, computeCarryForward, IN_FORCE_LEAVE_STATUSES } from "../../utils/leave.js";
import { hasPermission, isCustomRole } from "../../utils/permissions.js";
import { recordAudit, describeEmployee } from "../../utils/auditLog.js";
import {
  buildReportingScopeFilter,
  getHeadedDepartmentIds,
  isDepartmentHeadOf,
  isImmediateSupervisor,
} from "../../utils/orgHierarchy.js";

const applyLeaveSchema = z.object({
  leaveType: z.enum(["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "COMPENSATORY", "UNPAID", "SPECIAL"]),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(5),
  duration: z.enum(["FULL", "FIRST_HALF", "SECOND_HALF"]).default("FULL"),
  documentUrl: z.string().optional(),
});

function workingDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** SUPER_ADMIN / HR_ADMIN see and decide every leave, as before. */
function isLeaveAdmin(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

/**
 * May the caller force-cancel or delete anyone's leave? Super Admin and HR hold
 * this outright; a custom role needs an explicit EMP_LEAVES delete grant.
 * Deliberately narrower than `hasLeaveAuthorityOver` — supervisors approve and
 * reject, they don't erase records.
 */
async function canOverrideLeaves(user: JwtPayload): Promise<boolean> {
  if (isLeaveAdmin(user.role)) return true;
  return isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", "canDelete");
}

/**
 * Which balance bucket currently holds this leave's days.
 * PENDING parks them in `pending`; APPROVED (and an approved leave awaiting a
 * cancellation decision) has already moved them into `used`. Anything else has
 * released them already.
 */
function heldBucket(status: string): "pending" | "used" | null {
  if (status === "PENDING") return "pending";
  if (status === "APPROVED" || status === "CANCELLATION_PENDING") return "used";
  return null;
}

/**
 * Prisma op that hands the days back to the employee's balance. `updateMany` —
 * not `update` — because leaves can be applied for before a balance row exists
 * for that type/year, and a missing row must not blow up the cancellation.
 */
function releaseBalanceOp(application: { employeeId: string; leaveType: any; fromDate: Date; totalDays: number; status: string }) {
  const bucket = heldBucket(application.status);
  if (!bucket) return null;
  return prisma.leaveBalance.updateMany({
    where: {
      employeeId: application.employeeId,
      leaveType: application.leaveType,
      year: getFiscalYear(application.fromDate),
    },
    data: { [bucket]: { decrement: application.totalDays } },
  });
}

/** One-liner for the audit trail — readable after the row itself is gone. */
function summariseLeave(application: any): string {
  const from = new Date(application.fromDate).toISOString().slice(0, 10);
  const to = new Date(application.toDate).toISOString().slice(0, 10);
  const range = from === to ? from : `${from} → ${to}`;
  return `${describeEmployee(application.employee)} · ${application.leaveType} leave · ${application.totalDays} day(s) · ${range} · was ${application.status}`;
}

/**
 * Who may see or act on `targetId`'s leave records:
 *   - SUPER_ADMIN / HR_ADMIN
 *   - the employee's immediate supervisor (`reportingToId`)
 *   - the head of any department the employee belongs to
 *   - custom roles holding the matching EMP_LEAVES grant
 *
 * The supervisor and head checks are role-independent: an EMPLOYEE-role manager
 * has authority over their reports. They also never match self, so heading your
 * own department doesn't let you approve your own leave.
 */
async function hasLeaveAuthorityOver(
  user: JwtPayload,
  targetId: string,
  action: "canView" | "canApprove",
): Promise<boolean> {
  if (isLeaveAdmin(user.role)) return true;
  if (isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", action)) return true;
  if (await isImmediateSupervisor(user.sub, targetId)) return true;
  if (await isDepartmentHeadOf(user.sub, targetId)) return true;
  return false;
}

export async function leaveRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Apply for leave
  fastify.post("/apply", async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = applyLeaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    const { leaveType, fromDate, toDate, reason, duration, documentUrl } = parsed.data;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
      return reply.status(400).send({ success: false, error: "From date must be before to date", statusCode: 400 });
    }

    const isHalfDay = duration === "FIRST_HALF" || duration === "SECOND_HALF";
    if (isHalfDay && fromDate !== toDate) {
      return reply.status(400).send({ success: false, error: "Half-day leave must be for a single day", statusCode: 400 });
    }
    const totalDays = isHalfDay ? 0.5 : (fromDate === toDate ? 1 : workingDaysBetween(from, to));
    const year = getFiscalYear(from);

    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveType_year: { employeeId: user.sub, leaveType, year } },
    });

    // Allow application even with insufficient balance — supervisor decides
    const [application] = await prisma.$transaction([
      prisma.leaveApplication.create({
        data: {
          employeeId: user.sub,
          leaveType,
          fromDate: from,
          toDate: to,
          totalDays,
          reason,
          status: "PENDING",
          documentUrl,
        },
      }),
      // Only update pending count if a balance record exists
      prisma.leaveBalance.updateMany({
        where: { employeeId: user.sub, leaveType, year },
        data: { pending: { increment: totalDays } },
      }),
    ]);

    // Send email to supervisor (CC HR) — non-blocking
    sendEmailForLeave(user.sub, application, "APPLIED").catch(() => {});

    return reply.status(201).send({ success: true, data: application, message: "Leave application submitted" });
  });

  // Withdraw own leave.
  //   PENDING  → cancelled outright; nobody has acted on it yet.
  //   APPROVED → parks in CANCELLATION_PENDING; the approver has to sign off on
  //              undoing their own approval, so the days stay booked until they do.
  fastify.patch("/:id/cancel", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim() || null;

    const application = await prisma.leaveApplication.findUnique({ where: { id } });
    if (!application) {
      return reply.status(404).send({ success: false, error: "Application not found", statusCode: 404 });
    }
    if (application.employeeId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    if (application.status === "PENDING") {
      const ops: any[] = [
        prisma.leaveApplication.update({
          where: { id },
          data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
        }),
      ];
      const release = releaseBalanceOp(application);
      if (release) ops.push(release);

      const [updated] = await prisma.$transaction(ops);
      return reply.send({ success: true, data: updated, message: "Leave cancelled" });
    }

    if (application.status === "APPROVED") {
      if (!reason) {
        return reply.status(400).send({
          success: false,
          error: "Please give a reason — your approver has to sign off on cancelling an approved leave",
          statusCode: 400,
        });
      }
      const updated = await prisma.leaveApplication.update({
        where: { id },
        data: {
          status: "CANCELLATION_PENDING",
          cancelReason: reason,
          cancelRequestedAt: new Date(),
          cancelRejectionNote: null,
        },
      });
      sendEmailForLeave(user.sub, updated, "CANCEL_REQUESTED").catch(() => {});
      return reply.send({
        success: true,
        data: updated,
        message: "Cancellation requested — awaiting your approver's decision",
      });
    }

    return reply.status(400).send({
      success: false,
      error: application.status === "CANCELLATION_PENDING"
        ? "A cancellation request is already awaiting approval"
        : `Cannot cancel a leave that is already ${application.status.toLowerCase()}`,
      statusCode: 400,
    });
  });

  // Approver decides on a withdrawal request for a leave they already approved.
  fastify.patch("/:id/cancellation-decision", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: string; note?: string };

    if (body.action !== "APPROVED" && body.action !== "REJECTED") {
      return reply.status(400).send({ success: false, error: "action must be APPROVED or REJECTED", statusCode: 400 });
    }

    const application = await prisma.leaveApplication.findUnique({ where: { id } });
    if (!application || application.status !== "CANCELLATION_PENDING") {
      return reply.status(404).send({
        success: false,
        error: "No cancellation request awaiting a decision on this leave",
        statusCode: 404,
      });
    }
    if (!await hasLeaveAuthorityOver(user, application.employeeId, "canApprove")) {
      return reply.status(403).send({
        success: false,
        error: "Forbidden: you are not this employee's supervisor or department head",
        statusCode: 403,
      });
    }

    if (body.action === "REJECTED") {
      if (!body.note?.trim()) {
        return reply.status(400).send({ success: false, error: "A note is required when declining a cancellation", statusCode: 400 });
      }
      // Declined — the leave stands exactly as approved and the days stay booked.
      const updated = await prisma.leaveApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          cancelApproverId: user.sub,
          cancelRejectionNote: body.note.trim(),
          cancelRequestedAt: null,
        },
      });
      return reply.send({ success: true, data: updated, message: "Cancellation declined — leave stands" });
    }

    const ops: any[] = [
      prisma.leaveApplication.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelApproverId: user.sub,
          cancelledAt: new Date(),
          cancelRejectionNote: null,
        },
      }),
    ];
    const release = releaseBalanceOp(application);
    if (release) ops.push(release);

    const [updated] = await prisma.$transaction(ops);
    return reply.send({ success: true, data: updated, message: "Leave cancelled and days returned to balance" });
  });

  // Withdrawal requests waiting on the caller — same scope rules as /pending.
  fastify.get("/cancellation-requests", async (request, reply) => {
    const user = request.user as JwtPayload;

    const seesAll = isLeaveAdmin(user.role)
      || (isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", "canApprove"));
    const employeeFilter = seesAll ? undefined : await buildReportingScopeFilter(user.sub);

    const data = await prisma.leaveApplication.findMany({
      where: { status: "CANCELLATION_PENDING", ...(employeeFilter && { employee: employeeFilter }) },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        approver: { select: { firstName: true, lastName: true } },
      },
      orderBy: { cancelRequestedAt: "asc" },
    });
    return reply.send({ success: true, data });
  });

  // Admin override: cancel someone else's leave outright, whatever its state.
  // Logged, because it overrides a decision somebody else made.
  fastify.patch("/:id/admin-cancel", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!await canOverrideLeaves(user)) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }
    if (!reason) {
      return reply.status(400).send({ success: false, error: "A reason is required", statusCode: 400 });
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!application) {
      return reply.status(404).send({ success: false, error: "Application not found", statusCode: 404 });
    }
    if (application.status === "CANCELLED") {
      return reply.status(400).send({ success: false, error: "This leave is already cancelled", statusCode: 400 });
    }

    const ops: any[] = [
      prisma.leaveApplication.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelReason: reason,
          cancelApproverId: user.sub,
          cancelledAt: new Date(),
          cancelRequestedAt: null,
        },
      }),
    ];
    const release = releaseBalanceOp(application);
    if (release) ops.push(release);

    const [updated] = await prisma.$transaction(ops);

    await recordAudit({
      request,
      action: "FORCE_CANCEL",
      entity: "LeaveApplication",
      entityId: id,
      summary: summariseLeave(application),
      oldValues: application,
      newValues: { reason },
    });

    return reply.send({ success: true, data: updated, message: "Leave cancelled" });
  });

  // Admin override: delete the record entirely. The full snapshot goes to the
  // audit log first — this is the only trace that survives.
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!await canOverrideLeaves(user)) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }
    if (!reason) {
      return reply.status(400).send({ success: false, error: "A reason is required", statusCode: 400 });
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!application) {
      return reply.status(404).send({ success: false, error: "Application not found", statusCode: 404 });
    }

    const ops: any[] = [prisma.leaveApplication.delete({ where: { id } })];
    const release = releaseBalanceOp(application);
    if (release) ops.push(release);
    await prisma.$transaction(ops);

    await recordAudit({
      request,
      action: "DELETE",
      entity: "LeaveApplication",
      entityId: id,
      summary: summariseLeave(application),
      oldValues: application,
      newValues: { reason },
    });

    return reply.send({ success: true, data: null, message: "Leave application deleted" });
  });

  // Get my leave balances with accrual breakdown (auto-provisions from policy on first access)
  fastify.get("/balances", async (request, reply) => {
    const user = request.user as JwtPayload;
    const q = request.query as Record<string, string>;
    const year = q.year ? parseInt(q.year) : getFiscalYear(new Date());

    const employee = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { joiningDate: true, designation: { select: { grade: true } } },
    });
    const joiningDate = employee?.joiningDate ?? null;

    let balances = await prisma.leaveBalance.findMany({
      where: { employeeId: user.sub, year },
      orderBy: { leaveType: "asc" },
    });

    // Auto-provision from the applicable leave policy if no records exist yet
    if (balances.length === 0 && employee?.designation?.grade) {
      const policy = await prisma.leavePolicy.findFirst({
        where: {
          isActive: true,
          grades: { some: { grade: employee.designation.grade } },
        },
        include: { rules: true },
      });

      if (policy?.rules.length) {
        // Carry-forward unused balance from the prior FY when the policy allows it.
        const prevByType = new Map<string, { allocated: number; used: number }>();
        if (policy.carryForward) {
          const prev = await prisma.leaveBalance.findMany({
            where: { employeeId: user.sub, year: year - 1 },
          });
          prev.forEach((p) => prevByType.set(p.leaveType, p));
        }

        await Promise.all(
          policy.rules.map((rule) => {
            const carried = policy.carryForward
              ? computeCarryForward(prevByType.get(rule.leaveType), year - 1, joiningDate, rule.maxCarryForward)
              : 0;
            return prisma.leaveBalance.upsert({
              where: { employeeId_leaveType_year: { employeeId: user.sub, leaveType: rule.leaveType, year } },
              create: { employeeId: user.sub, leaveType: rule.leaveType, year, allocated: rule.daysPerYear, carried },
              update: {},
            });
          })
        );

        balances = await prisma.leaveBalance.findMany({
          where: { employeeId: user.sub, year },
          orderBy: { leaveType: "asc" },
        });
      }
    }

    const fyStart = new Date(year, 3, 1);
    const fyEnd   = new Date(year + 1, 3, 1);

    // Sum LoP days: UNPAID leaves + lopDays from other leave types
    const [unpaidLeaves, lopMarkedLeaves] = await Promise.all([
      prisma.leaveApplication.findMany({
        where: {
          employeeId: user.sub,
          leaveType: "UNPAID",
          status: { in: IN_FORCE_LEAVE_STATUSES },
          fromDate: { gte: fyStart, lt: fyEnd },
        },
        select: { totalDays: true },
      }),
      prisma.leaveApplication.findMany({
        where: {
          employeeId: user.sub,
          leaveType: { not: "UNPAID" },
          status: { in: IN_FORCE_LEAVE_STATUSES },
          lopDays: { gt: 0 },
          fromDate: { gte: fyStart, lt: fyEnd },
        },
        select: { lopDays: true },
      }),
    ]);
    const totalLopDays =
      unpaidLeaves.reduce((s, l) => s + l.totalDays, 0) +
      lopMarkedLeaves.reduce((s, l) => s + l.lopDays, 0);

    const data = balances.map((b) => {
      const accrued = computeAccrued(b.allocated, year, joiningDate);
      const availed = b.used + b.pending;
      return {
        leaveType: b.leaveType,
        allocated: b.allocated,
        accrued,
        used: b.used,
        pending: b.pending,
        availed,
        balance: Math.max(0, accrued + b.carried - availed),
        carried: b.carried,
      };
    });

    return reply.send({ success: true, data, lopDays: totalLopDays });
  });

  // Get my leaves
  fastify.get("/my", async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string>;
    const status = query.status;

    const data = await prisma.leaveApplication.findMany({
      where: { employeeId: user.sub, ...(status && { status: status as any }) },
      orderBy: { createdAt: "desc" },
      include: {
        approver: { select: { firstName: true, lastName: true } },
        cancelApprover: { select: { firstName: true, lastName: true } },
      },
    });
    return reply.send({ success: true, data });
  });

  // What approval authority does the caller hold? Drives whether the UI offers the
  // Team Leaves tab and the profile Leaves tab, since authority now comes from the
  // reporting line rather than the role name.
  fastify.get("/authority", async (request, reply) => {
    const user = request.user as JwtPayload;

    const [headedDepartmentIds, directReportCount] = await Promise.all([
      getHeadedDepartmentIds(user.sub),
      prisma.employee.count({ where: { reportingToId: user.sub, deletedAt: null } }),
    ]);

    const canApproveAny = isLeaveAdmin(user.role)
      || (isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", "canApprove"))
      || directReportCount > 0
      || headedDepartmentIds.length > 0;

    // Separate, stronger grant: force-cancelling and deleting other people's
    // records is Super Admin / HR territory, not every supervisor's.
    const canOverride = await canOverrideLeaves(user);

    return reply.send({
      success: true,
      data: { canApproveAny, canOverride, headedDepartmentIds, directReportCount },
    });
  });

  // Get pending leaves for approval
  fastify.get("/pending", async (request, reply) => {
    const user = request.user as JwtPayload;

    // SUPER_ADMIN / HR_ADMIN (and custom roles granted EMP_LEAVES approval) see
    // everything. Everyone else sees their direct reports plus the members of any
    // department they head — no role name required.
    const seesAll = isLeaveAdmin(user.role)
      || (isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", "canApprove"));

    const employeeFilter = seesAll ? undefined : await buildReportingScopeFilter(user.sub);

    const data = await prisma.leaveApplication.findMany({
      where: { status: "PENDING", ...(employeeFilter && { employee: employeeFilter }) },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data });
  });

  // Every leave record, for the roles allowed to override them. This is the
  // surface the cancel/delete controls hang off — /pending only ever shows the
  // undecided ones, and an admin has to be able to reach an approved leave too.
  fastify.get("/all", async (request, reply) => {
    const user = request.user as JwtPayload;
    if (!await canOverrideLeaves(user)) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const q = request.query as Record<string, string>;
    const take = Math.min(Math.max(parseInt(q.limit ?? "200", 10) || 200, 1), 500);

    const data = await prisma.leaveApplication.findMany({
      where: {
        ...(q.status && { status: q.status as any }),
        ...(q.employeeId && { employeeId: q.employeeId }),
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        approver: { select: { firstName: true, lastName: true } },
        cancelApprover: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return reply.send({ success: true, data });
  });

  // Get all leave records for a specific employee (supervisor/admin view)
  fastify.get("/employee/:employeeId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    // Admins, the employee's immediate supervisor, the head of a department they
    // belong to, or a custom role granted EMP_LEAVES view. Falls back to an
    // explicit My Team membership, which grants the same visibility.
    const allowed = user.sub === employeeId
      || await hasLeaveAuthorityOver(user, employeeId, "canView")
      || (await prisma.teamMembership.findFirst({
        where: { teamOwnerId: user.sub, memberId: employeeId },
      })) !== null;

    if (!allowed) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const data = await prisma.leaveApplication.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      include: {
        approver: { select: { firstName: true, lastName: true } },
        cancelApprover: { select: { firstName: true, lastName: true } },
      },
    });

    return reply.send({ success: true, data });
  });

  // Approve or reject leave
  fastify.patch("/:id/decision", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    const body = request.body as { action: "APPROVED" | "REJECTED"; note?: string; lopDays?: number };

    if (!["APPROVED", "REJECTED"].includes(body.action)) {
      return reply.status(400).send({ success: false, error: "Invalid action", statusCode: 400 });
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { employee: { select: { departmentId: true, reportingToId: true } } },
    });
    if (!application || application.status !== "PENDING") {
      return reply.status(404).send({ success: false, error: "Application not found or already processed", statusCode: 404 });
    }

    // Immediate supervisor or head of the employee's department — plus HR/SUPER_ADMIN
    // and custom roles with the EMP_LEAVES approve grant.
    if (!await hasLeaveAuthorityOver(user, application.employeeId, "canApprove")) {
      return reply.status(403).send({
        success: false,
        error: "Forbidden: you are not this employee's supervisor or department head",
        statusCode: 403,
      });
    }

    // Validate lopDays: must be between 0 and totalDays (inclusive)
    const lopDays = body.action === "APPROVED" && body.lopDays != null
      ? Math.min(Math.max(0, body.lopDays), application.totalDays)
      : 0;

    const year = getFiscalYear(application.fromDate);
    const updates: any[] = [
      prisma.leaveApplication.update({
        where: { id },
        data: {
          status: body.action,
          approverId: user.sub,
          approvedAt: body.action === "APPROVED" ? new Date() : null,
          rejectedAt: body.action === "REJECTED" ? new Date() : null,
          rejectionNote: body.action === "REJECTED" ? body.note : null,
          lopDays,
        },
      }),
    ];

    if (body.action === "APPROVED") {
      updates.push(
        prisma.leaveBalance.update({
          where: { employeeId_leaveType_year: { employeeId: application.employeeId, leaveType: application.leaveType, year } },
          data: { used: { increment: application.totalDays }, pending: { decrement: application.totalDays } },
        })
      );
    } else {
      updates.push(
        prisma.leaveBalance.update({
          where: { employeeId_leaveType_year: { employeeId: application.employeeId, leaveType: application.leaveType, year } },
          data: { pending: { decrement: application.totalDays } },
        })
      );
    }

    const [updated] = await prisma.$transaction(updates);
    return reply.send({ success: true, data: updated, message: `Leave ${body.action.toLowerCase()}${lopDays > 0 ? ` (${lopDays} day${lopDays !== 1 ? "s" : ""} LoP)` : ""}` });
  });

  // Get all leaves decided (approved/rejected) by the current manager/HR.
  // Inherently self-scoped by approverId, so no role gate is needed.
  fastify.get("/decided", async (request, reply) => {
    const user = request.user as JwtPayload;

    const data = await prisma.leaveApplication.findMany({
      where: {
        OR: [
          { approverId: user.sub, status: { in: ["APPROVED", "REJECTED"] } },
          // Cancellations they signed off on — the approval they undid would
          // otherwise vanish from their history entirely.
          { cancelApproverId: user.sub, status: "CANCELLED" },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return reply.send({ success: true, data });
  });

}

async function sendEmailForLeave(employeeId: string, application: any, action: "APPLIED" | "CANCEL_REQUESTED") {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      reportingTo: { select: { email: true, firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  });
  if (!employee) return;

  const hrEmails = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "HR" }, deletedAt: null },
    select: { email: true },
  });
  const hrCc = hrEmails.map((e) => e.email).join(",");

  const supervisorEmail = employee.reportingTo?.email;
  if (!supervisorEmail) return;

  const from = application.fromDate.toDateString?.() ?? application.fromDate;
  const to = application.toDate.toDateString?.() ?? application.toDate;
  const isCancelRequest = action === "CANCEL_REQUESTED";

  await sendMail({
    to: supervisorEmail,
    cc: hrCc || undefined,
    subject: isCancelRequest
      ? `Leave Cancellation Request: ${employee.firstName} ${employee.lastName} (${application.leaveType})`
      : `Leave Request: ${employee.firstName} ${employee.lastName} (${application.leaveType})`,
    html: `
      <p>Dear ${employee.reportingTo?.firstName},</p>
      <p><strong>${employee.firstName} ${employee.lastName}</strong> (${employee.employeeCode}, ${employee.department?.name}) ${
        isCancelRequest
          ? "wants to cancel a leave you have already approved."
          : "has applied for leave."
      }</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Leave Type</td><td><strong>${application.leaveType}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">From</td><td>${from}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">To</td><td>${to}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Days</td><td>${application.totalDays}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Reason</td><td>${application.reason}</td></tr>
        ${isCancelRequest ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Cancellation Reason</td><td>${application.cancelReason ?? "—"}</td></tr>` : ""}
      </table>
      <p>${
        isCancelRequest
          ? "Please log in to the dashboard to approve or decline this cancellation."
          : "Please log in to the dashboard to approve or reject this request."
      }</p>
      <p style="color:#999;font-size:12px">— Centum Academy HR System</p>
    `,
  });
}
