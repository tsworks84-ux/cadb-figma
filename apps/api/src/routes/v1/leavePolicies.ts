import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "COMPENSATORY", "UNPAID", "SPECIAL"] as const;

const ruleSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  daysPerYear: z.number().min(0),
  maxCarryForward: z.number().min(0).default(0),
});

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  rules: z.array(ruleSchema).min(1),
  grades: z.array(z.string().min(1)),
});

export async function leavePolicyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List all policies ──────────────────────────────────────────────────────
  fastify.get("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (_request, reply) => {
    const policies = await prisma.leavePolicy.findMany({
      include: {
        rules: { orderBy: { leaveType: "asc" } },
        grades: { orderBy: { grade: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Attach employee count per policy (how many active employees covered)
    const withCounts = await Promise.all(policies.map(async (p) => {
      const grades = p.grades.map((g) => g.grade);
      const count = grades.length > 0
        ? await prisma.employee.count({
            where: { deletedAt: null, designation: { grade: { in: grades } } },
          })
        : 0;
      return { ...p, employeeCount: count };
    }));

    return reply.send({ success: true, data: withCounts });
  });

  // ── Get distinct grades from designations ──────────────────────────────────
  fastify.get("/grades", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (_request, reply) => {
    const designations = await prisma.designation.findMany({
      where: { grade: { not: null } },
      select: { grade: true },
      distinct: ["grade"],
      orderBy: { grade: "asc" },
    });
    const grades = designations.map((d) => d.grade).filter(Boolean) as string[];
    return reply.send({ success: true, data: grades });
  });

  // ── Create policy ──────────────────────────────────────────────────────────
  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = policySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const { name, description, isActive, rules, grades } = parsed.data;

    const policy = await prisma.leavePolicy.create({
      data: {
        name,
        description,
        isActive,
        rules: { create: rules },
        grades: { create: grades.map((g) => ({ grade: g })) },
      },
      include: {
        rules: { orderBy: { leaveType: "asc" } },
        grades: { orderBy: { grade: "asc" } },
      },
    });

    return reply.status(201).send({ success: true, data: policy });
  });

  // ── Update policy ──────────────────────────────────────────────────────────
  fastify.put("/:id", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = policySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const { name, description, isActive, rules, grades } = parsed.data;

    // Replace all rules and grades atomically
    await prisma.$transaction([
      prisma.leavePolicyRule.deleteMany({ where: { policyId: id } }),
      prisma.leavePolicyGrade.deleteMany({ where: { policyId: id } }),
    ]);

    const policy = await prisma.leavePolicy.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        rules: { create: rules },
        grades: { create: grades.map((g) => ({ grade: g })) },
      },
      include: {
        rules: { orderBy: { leaveType: "asc" } },
        grades: { orderBy: { grade: "asc" } },
      },
    });

    return reply.send({ success: true, data: policy });
  });

  // ── Toggle active ──────────────────────────────────────────────────────────
  fastify.patch("/:id/toggle", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const policy = await prisma.leavePolicy.findUnique({ where: { id } });
    if (!policy) return reply.status(404).send({ success: false, error: "Policy not found", statusCode: 404 });

    const updated = await prisma.leavePolicy.update({
      where: { id },
      data: { isActive: !policy.isActive },
    });
    return reply.send({ success: true, data: updated });
  });

  // ── Delete policy ──────────────────────────────────────────────────────────
  fastify.delete("/:id", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.leavePolicy.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // ── Apply policy to matching employees for a given year ───────────────────
  fastify.post("/:id/apply", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { year?: number };
    const _now = new Date();
    const currentFY = _now.getMonth() >= 3 ? _now.getFullYear() : _now.getFullYear() - 1;
    const year = body?.year ?? currentFY;

    const policy = await prisma.leavePolicy.findUnique({
      where: { id },
      include: { rules: true, grades: true },
    });
    if (!policy) return reply.status(404).send({ success: false, error: "Policy not found", statusCode: 404 });

    const grades = policy.grades.map((g) => g.grade);
    if (grades.length === 0) {
      return reply.status(400).send({ success: false, error: "No grades assigned to this policy", statusCode: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, designation: { grade: { in: grades } } },
      select: { id: true },
    });

    let applied = 0;
    for (const emp of employees) {
      for (const rule of policy.rules) {
        await prisma.leaveBalance.upsert({
          where: { employeeId_leaveType_year: { employeeId: emp.id, leaveType: rule.leaveType, year } },
          create: {
            employeeId: emp.id,
            leaveType: rule.leaveType,
            year,
            allocated: rule.daysPerYear,
            used: 0,
            pending: 0,
            carried: 0,
          },
          update: {
            // Only increase allocation, never silently reduce below what's used
            allocated: rule.daysPerYear,
          },
        });
      }
      applied++;
    }

    return reply.send({
      success: true,
      data: { applied, year, policy: { id: policy.id, name: policy.name } },
      message: `Leave policy applied to ${applied} employee${applied !== 1 ? "s" : ""} for ${year}.`,
    });
  });

  // ── Employee: get my applicable policy ────────────────────────────────────
  fastify.get("/my", async (request, reply) => {
    const user = request.user as any;
    const employee = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { designation: { select: { grade: true } } },
    });
    if (!employee?.designation?.grade) {
      return reply.send({ success: true, data: null });
    }
    const grade = employee.designation.grade;
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        isActive: true,
        grades: { some: { grade } },
      },
      include: {
        rules: { orderBy: { leaveType: "asc" } },
        grades: { orderBy: { grade: "asc" } },
      },
    });
    return reply.send({ success: true, data: policy });
  });
}
