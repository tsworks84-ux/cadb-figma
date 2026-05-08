import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";

const FREQ_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

function generatePayouts(
  planId: string,
  employeeId: string,
  totalAmount: number,
  frequency: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
): Array<{ planId: string; employeeId: string; amount: number; scheduledDate: Date }> {
  if (frequency === "CUSTOM") return [];
  const intervalMonths = FREQ_MONTHS[frequency];
  if (!intervalMonths) return [];

  const entries = [];
  const end = effectiveTo ?? new Date(effectiveFrom.getFullYear() + 1, effectiveFrom.getMonth(), effectiveFrom.getDate());

  // Calculate number of intervals in the period
  const monthsDiff =
    (end.getFullYear() - effectiveFrom.getFullYear()) * 12 +
    (end.getMonth() - effectiveFrom.getMonth());
  const count = Math.max(1, Math.round(monthsDiff / intervalMonths));
  const perPayout = Math.round((totalAmount / count) * 100) / 100;

  let current = new Date(effectiveFrom);
  for (let i = 0; i < count; i++) {
    entries.push({ planId, employeeId, amount: perPayout, scheduledDate: new Date(current) });
    current = new Date(current.getFullYear(), current.getMonth() + intervalMonths, current.getDate());
    if (current > end) break;
  }
  return entries;
}

function canActAsAppraiser(user: JwtPayload): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN" || user.role === "DEPT_HEAD";
}

const createPlanSchema = z.object({
  title: z.string().min(1),
  totalAmount: z.number().positive(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"]),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
});

const createPayoutSchema = z.object({
  amount: z.number().positive(),
  scheduledDate: z.string().datetime(),
  notes: z.string().optional(),
});

export async function bonusRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Get bonus plans for employee ──────────────────────────────────────────
  fastify.get("/employees/:employeeId/bonus-plans", async (request, reply) => {
    const { employeeId } = request.params as { employeeId: string };
    const user = request.user as JwtPayload;

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    const isSelf = user.sub === employeeId;
    const isSupervisor = !isAdmin && (await prisma.employee.findFirst({
      where: { id: employeeId, reportingToId: user.sub },
    })) != null;

    if (!isAdmin && !isSelf && !isSupervisor) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const plans = await prisma.bonusPlan.findMany({
      where: { employeeId },
      include: {
        appraiser: { select: { id: true, firstName: true, lastName: true } },
        payouts: { orderBy: { scheduledDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: plans });
  });

  // ── Create bonus plan ──────────────────────────────────────────────────────
  fastify.post("/employees/:employeeId/bonus-plans", async (request, reply) => {
    const { employeeId } = request.params as { employeeId: string };
    const user = request.user as JwtPayload;

    if (!canActAsAppraiser(user)) {
      return reply.status(403).send({ success: false, error: "Only admins and supervisors can create bonus plans", statusCode: 403 });
    }

    // Supervisors can only appraise their direct reports
    if (user.role !== "SUPER_ADMIN" && user.role !== "HR_ADMIN") {
      const directReport = await prisma.employee.findFirst({ where: { id: employeeId, reportingToId: user.sub } });
      if (!directReport) {
        return reply.status(403).send({ success: false, error: "You can only appraise your direct reports", statusCode: 403 });
      }
    }

    const parsed = createPlanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    const d = parsed.data;
    const effectiveFrom = new Date(d.effectiveFrom);
    const effectiveTo = d.effectiveTo ? new Date(d.effectiveTo) : null;

    const plan = await prisma.bonusPlan.create({
      data: {
        employeeId,
        appraiserId: user.sub,
        title: d.title,
        totalAmount: d.totalAmount,
        frequency: d.frequency as any,
        effectiveFrom,
        effectiveTo,
        notes: d.notes,
      },
    });

    // Auto-generate payouts for non-CUSTOM frequencies
    if (d.frequency !== "CUSTOM") {
      const payoutEntries = generatePayouts(plan.id, employeeId, d.totalAmount, d.frequency, effectiveFrom, effectiveTo);
      if (payoutEntries.length > 0) {
        await prisma.bonusPayout.createMany({ data: payoutEntries });
      }
    }

    const full = await prisma.bonusPlan.findUnique({
      where: { id: plan.id },
      include: {
        appraiser: { select: { id: true, firstName: true, lastName: true } },
        payouts: { orderBy: { scheduledDate: "asc" } },
      },
    });

    return reply.status(201).send({ success: true, data: full });
  });

  // ── Update bonus plan status / notes ──────────────────────────────────────
  fastify.patch("/bonus-plans/:planId", async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const user = request.user as JwtPayload;

    const plan = await prisma.bonusPlan.findUnique({ where: { id: planId } });
    if (!plan) return reply.status(404).send({ success: false, error: "Plan not found", statusCode: 404 });

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAdmin && plan.appraiserId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const body = request.body as { status?: string; notes?: string };
    const updated = await prisma.bonusPlan.update({
      where: { id: planId },
      data: {
        ...(body.status ? { status: body.status as any } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: {
        appraiser: { select: { id: true, firstName: true, lastName: true } },
        payouts: { orderBy: { scheduledDate: "asc" } },
      },
    });

    return reply.send({ success: true, data: updated });
  });

  // ── Add custom payout entry ───────────────────────────────────────────────
  fastify.post("/bonus-plans/:planId/payouts", async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const user = request.user as JwtPayload;

    const plan = await prisma.bonusPlan.findUnique({ where: { id: planId } });
    if (!plan) return reply.status(404).send({ success: false, error: "Plan not found", statusCode: 404 });

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAdmin && plan.appraiserId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    if (plan.frequency !== "CUSTOM") {
      return reply.status(400).send({ success: false, error: "Manual payouts can only be added to CUSTOM frequency plans", statusCode: 400 });
    }

    const parsed = createPayoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    // Enforce total payout cap against plan.totalAmount
    const existing = await prisma.bonusPayout.aggregate({
      where: { planId, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    });
    const committed = existing._sum.amount ?? 0;
    const remaining = plan.totalAmount - committed;
    if (parsed.data.amount > remaining + 0.001) {
      return reply.status(400).send({
        success: false,
        error: `Payout of ₹${parsed.data.amount.toLocaleString("en-IN")} exceeds the remaining budget of ₹${remaining.toLocaleString("en-IN")} (plan total: ₹${plan.totalAmount.toLocaleString("en-IN")}).`,
        statusCode: 400,
      });
    }

    const payout = await prisma.bonusPayout.create({
      data: {
        planId,
        employeeId: plan.employeeId,
        amount: parsed.data.amount,
        scheduledDate: new Date(parsed.data.scheduledDate),
        notes: parsed.data.notes,
      },
    });

    return reply.status(201).send({ success: true, data: payout });
  });

  // ── Mark payout as paid ───────────────────────────────────────────────────
  fastify.patch("/bonus-payouts/:payoutId/pay", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { payoutId } = request.params as { payoutId: string };

    const payout = await prisma.bonusPayout.findUnique({ where: { id: payoutId } });
    if (!payout) return reply.status(404).send({ success: false, error: "Payout not found", statusCode: 404 });

    const updated = await prisma.bonusPayout.update({
      where: { id: payoutId },
      data: { status: "PAID", paidAt: new Date() },
    });

    return reply.send({ success: true, data: updated });
  });

  // ── Cancel payout ─────────────────────────────────────────────────────────
  fastify.patch("/bonus-payouts/:payoutId/cancel", async (request, reply) => {
    const { payoutId } = request.params as { payoutId: string };
    const user = request.user as JwtPayload;

    const payout = await prisma.bonusPayout.findUnique({ where: { id: payoutId }, include: { plan: true } });
    if (!payout) return reply.status(404).send({ success: false, error: "Payout not found", statusCode: 404 });

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAdmin && payout.plan.appraiserId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const updated = await prisma.bonusPayout.update({
      where: { id: payoutId },
      data: { status: "CANCELLED" },
    });

    return reply.send({ success: true, data: updated });
  });
}
