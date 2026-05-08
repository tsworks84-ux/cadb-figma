import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

async function getMemberStatus(memberId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const activeLeave = await prisma.leaveApplication.findFirst({
    where: {
      employeeId: memberId,
      status: "APPROVED",
      fromDate: { lte: tomorrow },
      toDate: { gte: today },
    },
    select: { leaveType: true, fromDate: true, toDate: true },
  });

  return {
    presence: activeLeave ? "ON_LEAVE" : "PRESENT",
    activeLeave: activeLeave ?? null,
  };
}

async function findMember(memberId: string) {
  return prisma.employee.findFirst({
    where: { id: memberId, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      status: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
  });
}

export async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Get team for an employee ──────────────────────────────────────────────
  fastify.get("/:id/team", async (request, reply) => {
    const { id } = request.params as { id: string };

    const memberships = await prisma.teamMembership.findMany({
      where: { teamOwnerId: id },
      orderBy: { addedAt: "asc" },
    });

    if (memberships.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const memberIds = memberships.map((m) => m.memberId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 3 queries total regardless of team size (was 3N before)
    const [members, activeLeaves, allTasks] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: memberIds }, deletedAt: null },
        select: {
          id: true, employeeCode: true, firstName: true, lastName: true,
          photoUrl: true, status: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
        },
      }),
      prisma.leaveApplication.findMany({
        where: {
          employeeId: { in: memberIds },
          status: "APPROVED",
          fromDate: { lte: tomorrow },
          toDate: { gte: today },
        },
        select: { employeeId: true, leaveType: true, fromDate: true, toDate: true },
      }),
      prisma.task.findMany({
        where: { assignedToId: { in: memberIds }, status: { not: "CANCELLED" } },
        select: { assignedToId: true, status: true, dueDate: true },
      }),
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m]));
    const leaveMap = new Map(activeLeaves.map((l) => [l.employeeId, l]));
    const taskMap = allTasks.reduce<Record<string, typeof allTasks>>((acc, t) => {
      (acc[t.assignedToId] ??= []).push(t);
      return acc;
    }, {});

    const data = memberships
      .map((m) => {
        const member = memberMap.get(m.memberId) ?? null;
        const activeLeave = leaveMap.get(m.memberId) ?? null;
        const tasks = taskMap[m.memberId] ?? [];
        const total = tasks.length;
        const completed = tasks.filter((t) => t.status === "COMPLETED").length;
        const due = tasks.filter((t) => t.status !== "COMPLETED" && new Date(t.dueDate) < today).length;
        return {
          id: m.id,
          memberId: m.memberId,
          addedAt: m.addedAt,
          member,
          presence: activeLeave ? "ON_LEAVE" : "PRESENT",
          activeLeave,
          tasks: { total, due, completed },
        };
      })
      .filter((m) => m.member !== null);

    return reply.send({ success: true, data });
  });

  // ── Add a team member (admin / HR / DEPT_HEAD only) ───────────────────────
  fastify.post(
    "/:id/team",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ memberId: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: "memberId required", statusCode: 400 });
      }
      if (parsed.data.memberId === id) {
        return reply.status(400).send({ success: false, error: "An employee cannot be their own team member", statusCode: 400 });
      }

      const member = await findMember(parsed.data.memberId);
      if (!member) {
        return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
      }

      const membership = await prisma.teamMembership.upsert({
        where: { teamOwnerId_memberId: { teamOwnerId: id, memberId: parsed.data.memberId } },
        create: { teamOwnerId: id, memberId: parsed.data.memberId },
        update: {},
      });

      const { presence, activeLeave } = await getMemberStatus(membership.memberId);
      return reply.status(201).send({
        success: true,
        data: { id: membership.id, memberId: membership.memberId, addedAt: membership.addedAt, member, presence, activeLeave, tasks: { total: 0, due: 0, completed: 0 } },
      });
    }
  );

  // ── Remove a team member (admin / HR / DEPT_HEAD only) ────────────────────
  fastify.delete(
    "/:id/team/:memberId",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") },
    async (request, reply) => {
      const { id, memberId } = request.params as { id: string; memberId: string };
      await prisma.teamMembership.deleteMany({ where: { teamOwnerId: id, memberId } });
      return reply.send({ success: true, data: null });
    }
  );

  // ── Search employees to add ───────────────────────────────────────────────
  fastify.get(
    "/:id/team/search",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const q = (request.query as any).q as string | undefined;

      const existingIds = (
        await prisma.teamMembership.findMany({
          where: { teamOwnerId: id },
          select: { memberId: true },
        })
      ).map((m) => m.memberId);

      const employees = await prisma.employee.findMany({
        where: {
          deletedAt: null,
          id: { notIn: [id, ...existingIds] },
          ...(q && {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
            ],
          }),
        },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          status: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: 20,
      });

      return reply.send({ success: true, data: employees });
    }
  );
}
