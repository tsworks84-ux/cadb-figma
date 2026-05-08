import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

function holidayDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

const holidaySchema = z.object({
  name: z.string().min(1),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  description: z.string().optional(),
});

export async function holidayRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List holidays (all roles) ─────────────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const now = new Date();
    const year = q.year ? parseInt(q.year) : now.getFullYear();

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { fromDate: "asc" },
    });

    const data = holidays.map((h) => ({
      ...h,
      numberOfDays: holidayDays(h.fromDate, h.toDate),
    }));

    return reply.send({ success: true, data });
  });

  // ── Create holiday (admin only) ───────────────────────────────────────────
  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = holidaySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const { name, fromDate, toDate, description } = parsed.data;
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to < from) {
      return reply.status(400).send({ success: false, error: "To date must be on or after from date", statusCode: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        fromDate: from,
        toDate: to,
        year: from.getFullYear(),
        description,
      },
    });

    return reply.status(201).send({
      success: true,
      data: { ...holiday, numberOfDays: holidayDays(holiday.fromDate, holiday.toDate) },
    });
  });

  // ── Update holiday (admin only) ───────────────────────────────────────────
  fastify.put("/:id", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = holidaySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const { name, fromDate, toDate, description } = parsed.data;
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const holiday = await prisma.holiday.update({
      where: { id },
      data: { name, fromDate: from, toDate: to, year: from.getFullYear(), description },
    });

    return reply.send({
      success: true,
      data: { ...holiday, numberOfDays: holidayDays(holiday.fromDate, holiday.toDate) },
    });
  });

  // ── Delete holiday (admin only) ───────────────────────────────────────────
  fastify.delete("/:id", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.holiday.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
