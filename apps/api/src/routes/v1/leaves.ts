import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { sendMail } from "../../utils/mailer.js";
import { getFiscalYear, computeAccrued, computeCarryForward } from "../../utils/leave.js";
import { hasPermission, isCustomRole } from "../../utils/permissions.js";
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

  // Cancel own PENDING leave
  fastify.patch("/:id/cancel", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const application = await prisma.leaveApplication.findUnique({ where: { id } });
    if (!application) {
      return reply.status(404).send({ success: false, error: "Application not found", statusCode: 404 });
    }
    if (application.employeeId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }
    if (application.status !== "PENDING") {
      return reply.status(400).send({
        success: false,
        error: `Cannot cancel a leave that is already ${application.status.toLowerCase()}`,
        statusCode: 400,
      });
    }

    const year = getFiscalYear(application.fromDate);
    const [updated] = await prisma.$transaction([
      prisma.leaveApplication.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      prisma.leaveBalance.update({
        where: { employeeId_leaveType_year: { employeeId: user.sub, leaveType: application.leaveType, year } },
        data: { pending: { decrement: application.totalDays } },
      }),
    ]);

    return reply.send({ success: true, data: updated, message: "Leave cancelled" });
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
          status: "APPROVED",
          fromDate: { gte: fyStart, lt: fyEnd },
        },
        select: { totalDays: true },
      }),
      prisma.leaveApplication.findMany({
        where: {
          employeeId: user.sub,
          leaveType: { not: "UNPAID" },
          status: "APPROVED",
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

    return reply.send({
      success: true,
      data: { canApproveAny, headedDepartmentIds, directReportCount },
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
        approverId: user.sub,
        status: { in: ["APPROVED", "REJECTED"] },
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

async function sendEmailForLeave(employeeId: string, application: any, action: "APPLIED") {
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

  await sendMail({
    to: supervisorEmail,
    cc: hrCc || undefined,
    subject: `Leave Request: ${employee.firstName} ${employee.lastName} (${application.leaveType})`,
    html: `
      <p>Dear ${employee.reportingTo?.firstName},</p>
      <p><strong>${employee.firstName} ${employee.lastName}</strong> (${employee.employeeCode}, ${employee.department?.name}) has applied for leave.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Leave Type</td><td><strong>${application.leaveType}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">From</td><td>${from}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">To</td><td>${to}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Days</td><td>${application.totalDays}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Reason</td><td>${application.reason}</td></tr>
      </table>
      <p>Please log in to the dashboard to approve or reject this request.</p>
      <p style="color:#999;font-size:12px">— Centum Academy HR System</p>
    `,
  });
}
