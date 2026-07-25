import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { sendMail } from "../../utils/mailer.js";
import { getFiscalYear, computeAccrued, computeCarryForward } from "../../utils/leave.js";

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

  // Get pending leaves for approval
  fastify.get("/pending", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") }, async (request, reply) => {
    const user = request.user as JwtPayload;

    // SUPER_ADMIN and HR_ADMIN see all pending leaves.
    // DEPT_HEAD sees only leaves from employees whose reporting manager is them.
    const employeeFilter =
      user.role === "DEPT_HEAD"
        ? { reportingToId: user.sub }
        : undefined;

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

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAdmin) {
      const membership = await prisma.teamMembership.findFirst({
        where: { teamOwnerId: user.sub, memberId: employeeId },
      });
      if (!membership) {
        return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
      }
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
  fastify.patch("/:id/decision", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") }, async (request, reply) => {
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

    // DEPT_HEAD may only approve leaves for employees who report directly to them
    if (user.role === "DEPT_HEAD") {
      if (application.employee.reportingToId !== user.sub) {
        return reply.status(403).send({ success: false, error: "Forbidden: this employee does not report to you", statusCode: 403 });
      }
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

  // Get all leaves decided (approved/rejected) by the current manager/HR
  fastify.get("/decided", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") }, async (request, reply) => {
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
