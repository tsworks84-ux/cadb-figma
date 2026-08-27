import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { getFiscalYear } from "../../utils/leave.js";
import { hasPermission, isCustomRole } from "../../utils/permissions.js";
import { notifyCompOffEvent } from "../../utils/notify/index.js";
import {
  buildReportingScopeFilter,
  isImmediateSupervisor,
  isDepartmentHeadOf,
} from "../../utils/orgHierarchy.js";

/**
 * Compensatory offs.
 *
 * An employee who worked on a day they were not due to work claims the day
 * back here. The claim is worth nothing until their supervisor approves it —
 * approval is what credits the day into the COMPENSATORY bucket of their leave
 * balance, which they then spend through the ordinary /leaves/apply flow.
 *
 * The credit lands in `LeaveBalance.earned`, not `allocated`: allocated feeds
 * the monthly accrual curve, and a comp-off is earned outright on the day it is
 * approved, not dripped out over the rest of the year.
 *
 * Deliberately no date rule on `workDate`. The office works Mon–Sat, but exam
 * duty, declared holidays and shift patterns all make "was that really your off
 * day?" a question the supervisor can answer and a weekday check cannot. The
 * listings below hand the approver the weekday and any matching holiday so the
 * judgement is an informed one.
 */

const raiseSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "workDate must be YYYY-MM-DD"),
  days: z.union([z.literal(0.5), z.literal(1)]).default(1),
  reason: z.string().min(5),
});

/** Statuses that still lay claim to a work date — a second claim for the same day is a duplicate. */
const ACTIVE_STATUSES = ["PENDING", "APPROVED"] as const;

function isLeaveAdmin(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

/**
 * Same authority rule as leave approvals: admins, custom roles holding the
 * EMP_LEAVES grant, the immediate supervisor, or the head of a department the
 * employee belongs to. Comp-off is a leave credit, so it answers to the people
 * who already decide leave — no new permission module to configure.
 */
async function hasCompOffAuthorityOver(
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

const employeeSelect = {
  id: true, employeeCode: true, firstName: true, lastName: true,
  department: { select: { name: true } },
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Annotate rows with what the work date actually was, so nobody has to work it
 * out from a raw timestamp: the weekday, whether it was a Sunday (the standing
 * weekly off for the Mon–Sat week), and the name of any declared holiday it
 * fell on. One holiday query covers the whole list.
 */
async function withDayContext<T extends { workDate: Date }>(rows: T[]) {
  if (rows.length === 0) return [];

  const dates = rows.map((r) => r.workDate.getTime());
  const holidays = await prisma.holiday.findMany({
    where: {
      fromDate: { lte: new Date(Math.max(...dates)) },
      toDate:   { gte: new Date(Math.min(...dates)) },
    },
    select: { name: true, fromDate: true, toDate: true },
  });

  return rows.map((r) => {
    const day = r.workDate.getTime();
    const holiday = holidays.find((h) => day >= h.fromDate.getTime() && day <= h.toDate.getTime());
    return {
      ...r,
      weekday: WEEKDAYS[r.workDate.getUTCDay()],
      isWeeklyOff: r.workDate.getUTCDay() === 0,
      holidayName: holiday?.name ?? null,
    };
  });
}

export async function compOffRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Claim a comp-off for a day worked.
  fastify.post("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = raiseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
        statusCode: 400,
      });
    }

    const { workDate, days, reason } = parsed.data;
    // Leave dates are stored at UTC midnight; a comp-off date has to match so
    // the two can be compared and displayed the same way.
    const date = new Date(`${workDate}T00:00:00.000Z`);

    // A day you have not worked yet is not a day you can claim back. Compared in
    // UTC against the server's own date, same basis as /leaves/on-date.
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    if (date.getTime() > today) {
      return reply.status(400).send({
        success: false,
        error: "You can only claim a comp-off for a day you have already worked",
        statusCode: 400,
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { joiningDate: true },
    });
    if (employee?.joiningDate && date < employee.joiningDate) {
      return reply.status(400).send({
        success: false,
        error: "That date is before your joining date",
        statusCode: 400,
      });
    }

    const clash = await prisma.compOffRequest.findFirst({
      where: { employeeId: user.sub, workDate: date, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (clash) {
      return reply.status(409).send({
        success: false,
        error: clash.status === "APPROVED"
          ? "You already have an approved comp-off for that date"
          : "You already have a comp-off request awaiting a decision for that date",
        statusCode: 409,
      });
    }

    const created = await prisma.compOffRequest.create({
      data: { employeeId: user.sub, workDate: date, days, reason, status: "PENDING" },
    });

    // Same outbox as leaves: queued here, delivered out-of-band, never able to
    // fail the request that caused it.
    await notifyCompOffEvent("COMP_OFF_REQUESTED", created);

    return reply.status(201).send({
      success: true,
      data: created,
      message: "Comp-off request submitted — awaiting your supervisor's approval",
    });
  });

  // My comp-off requests, newest work date first.
  fastify.get("/my", async (request, reply) => {
    const user = request.user as JwtPayload;

    const rows = await prisma.compOffRequest.findMany({
      where: { employeeId: user.sub },
      include: { approver: { select: { firstName: true, lastName: true } } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });

    const data = await withDayContext(rows);
    const earned = rows
      .filter((r) => r.status === "APPROVED")
      .reduce((sum, r) => sum + r.days, 0);
    const awaiting = rows
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + r.days, 0);

    return reply.send({ success: true, data, summary: { earned, awaiting } });
  });

  // Withdraw a request nobody has decided on yet. An approved credit is a
  // different matter — it has already moved a day into the balance, so undoing
  // it is the approver's call, not the employee's.
  fastify.patch("/:id/cancel", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const row = await prisma.compOffRequest.findUnique({ where: { id } });
    if (!row) {
      return reply.status(404).send({ success: false, error: "Request not found", statusCode: 404 });
    }
    if (row.employeeId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }
    if (row.status !== "PENDING") {
      return reply.status(400).send({
        success: false,
        error: `Cannot withdraw a request that is already ${row.status.toLowerCase()}`,
        statusCode: 400,
      });
    }

    const updated = await prisma.compOffRequest.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return reply.send({ success: true, data: updated, message: "Comp-off request withdrawn" });
  });

  // The approver's queue. Everything in the caller's scope, so one fetch serves
  // both the pending list and the record of what they have already decided.
  fastify.get("/team", async (request, reply) => {
    const user = request.user as JwtPayload;
    const q = request.query as Record<string, string>;

    const seesAll = isLeaveAdmin(user.role)
      || (isCustomRole(user.role) && await hasPermission(user, "EMP_LEAVES", "canApprove"));
    const employeeFilter = seesAll ? undefined : await buildReportingScopeFilter(user.sub);

    const rows = await prisma.compOffRequest.findMany({
      where: {
        ...(q.status && { status: q.status as any }),
        ...(employeeFilter && { employee: employeeFilter }),
      },
      include: {
        employee: { select: employeeSelect },
        approver: { select: { firstName: true, lastName: true } },
      },
      // Undecided ones first, then the most recent work dates — an approver
      // opens this to clear the queue, not to browse history.
      orderBy: [{ status: "asc" }, { workDate: "desc" }],
      take: 200,
    });

    return reply.send({ success: true, data: await withDayContext(rows) });
  });

  // Someone else's comp-off record — the profile view for supervisors and HR.
  fastify.get("/employee/:employeeId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    if (user.sub !== employeeId && !await hasCompOffAuthorityOver(user, employeeId, "canView")) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const rows = await prisma.compOffRequest.findMany({
      where: { employeeId },
      include: { approver: { select: { firstName: true, lastName: true } } },
      orderBy: [{ workDate: "desc" }],
    });
    return reply.send({ success: true, data: await withDayContext(rows) });
  });

  // Approve or reject. Approval is the only thing that mints comp-off days.
  fastify.patch("/:id/decision", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: string; note?: string; days?: number };

    if (body.action !== "APPROVED" && body.action !== "REJECTED") {
      return reply.status(400).send({ success: false, error: "action must be APPROVED or REJECTED", statusCode: 400 });
    }

    const row = await prisma.compOffRequest.findUnique({ where: { id } });
    if (!row || row.status !== "PENDING") {
      return reply.status(404).send({
        success: false,
        error: "Request not found or already decided",
        statusCode: 404,
      });
    }
    if (row.employeeId === user.sub) {
      return reply.status(403).send({
        success: false,
        error: "You cannot decide on your own comp-off request",
        statusCode: 403,
      });
    }
    if (!await hasCompOffAuthorityOver(user, row.employeeId, "canApprove")) {
      return reply.status(403).send({
        success: false,
        error: "Forbidden: you are not this employee's supervisor or department head",
        statusCode: 403,
      });
    }

    if (body.action === "REJECTED") {
      if (!body.note?.trim()) {
        return reply.status(400).send({ success: false, error: "A note is required when rejecting", statusCode: 400 });
      }
      const updated = await prisma.compOffRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          approverId: user.sub,
          rejectedAt: new Date(),
          rejectionNote: body.note.trim(),
        },
      });
      await notifyCompOffEvent("COMP_OFF_REJECTED", updated);
      return reply.send({ success: true, data: updated, message: "Comp-off request rejected" });
    }

    // The approver may credit less than was claimed — a half day for someone who
    // came in for the morning only. Never more, and never nothing.
    const days = body.days != null
      ? Math.min(Math.max(0.5, body.days), row.days)
      : row.days;

    // The credit belongs to the FY the work fell in, so a March Sunday tops up
    // last year's balance rather than the new one. The row may not exist —
    // COMPENSATORY is often absent from the leave policy — so upsert it with a
    // zero allocation: nothing accrues into this bucket, it is only ever earned.
    const year = getFiscalYear(row.workDate);
    const [updated] = await prisma.$transaction([
      prisma.compOffRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          days,
          approverId: user.sub,
          approvedAt: new Date(),
          rejectionNote: null,
        },
      }),
      prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveType_year: { employeeId: row.employeeId, leaveType: "COMPENSATORY", year },
        },
        create: {
          employeeId: row.employeeId, leaveType: "COMPENSATORY", year,
          allocated: 0, earned: days,
        },
        update: { earned: { increment: days } },
      }),
    ]);

    await notifyCompOffEvent("COMP_OFF_APPROVED", updated);

    return reply.send({
      success: true,
      data: updated,
      message: `Comp-off approved — ${days} day${days !== 1 ? "s" : ""} credited`,
    });
  });
}
