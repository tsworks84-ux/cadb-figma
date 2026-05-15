import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";

const scheduleSchema = z.object({
  academicYear: z.string().min(1),
  batchIds:     z.array(z.string()).min(1, "At least one batch required"),
  subjectId:    z.string().optional().nullable(),
  employeeId:   z.string().optional().nullable(),
  locationId:   z.string().optional().nullable(),
  date:         z.string().min(1),
  startTime:    z.string().min(1),
  endTime:      z.string().min(1),
  topics:       z.string().optional(),
  notes:        z.string().optional(),
});

const scheduleInclude = {
  subject:  { select: { id: true, code: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  location: { select: { id: true, name: true } },
  batches:  {
    include: {
      batch: { select: { id: true, name: true, academicYear: true, gradeId: true, grade: { select: { id: true, name: true } } } },
    },
  },
} as const;

function requireAdmin(request: any, reply: any) {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
}

export async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── LIST ───────────────────────────────────────────────────────────────────

  fastify.get("/", async (request, reply) => {
    const {
      view, status, dateFrom, dateTo,
      academicYear, batchId, gradeId, employeeId, locationId,
      page = "1", limit = "50",
    } = request.query as any;

    const where: any = {};

    if (status && status !== "ALL")  where.status = status;
    if (academicYear) where.academicYear = academicYear;
    if (employeeId)   where.employeeId   = employeeId;
    if (locationId)   where.locationId   = locationId;

    if (view === "UPCOMING") where.date = { gte: new Date(new Date().toDateString()) };
    else if (view === "PAST") where.date = { lt: new Date(new Date().toDateString()) };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo)   where.date.lte = new Date(dateTo);
    }

    if (batchId || gradeId) {
      where.batches = {
        some: {
          ...(batchId ? { batchId } : {}),
          ...(gradeId ? { batch: { gradeId } } : {}),
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: scheduleInclude,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        skip,
        take: parseInt(limit),
      }),
      prisma.schedule.count({ where }),
    ]);

    return reply.send({ success: true, data: schedules, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  });

  // ── GET ONE ────────────────────────────────────────────────────────────────

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const schedule = await prisma.schedule.findUnique({ where: { id }, include: scheduleInclude });
    if (!schedule) return reply.status(404).send({ success: false, error: "Schedule not found" });
    return reply.send({ success: true, data: schedule });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  fastify.post("/", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = scheduleSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { batchIds, date, startTime, endTime, ...rest } = parsed.data;

    const schedule = await prisma.schedule.create({
      data: {
        ...rest,
        date:      new Date(date),
        startTime: new Date(startTime),
        endTime:   new Date(endTime),
        batches:   { create: batchIds.map((batchId) => ({ batchId })) },
      },
      include: scheduleInclude,
    });
    return reply.status(201).send({ success: true, data: schedule });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = scheduleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { batchIds, date, startTime, endTime, ...rest } = parsed.data;

    const schedule = await prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.scheduleBatch.deleteMany({ where: { scheduleId: id } });
      }
      return tx.schedule.update({
        where: { id },
        data: {
          ...rest,
          ...(date      ? { date:      new Date(date)      } : {}),
          ...(startTime ? { startTime: new Date(startTime) } : {}),
          ...(endTime   ? { endTime:   new Date(endTime)   } : {}),
          ...(batchIds  ? { batches:   { create: batchIds.map((batchId) => ({ batchId })) } } : {}),
        },
        include: scheduleInclude,
      });
    });

    return reply.send({ success: true, data: schedule });
  });

  // ── STATUS ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id/status", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const { status } = request.body as any;

    const valid = ["UPCOMING", "COMPLETED", "CANCELLED"];
    if (!valid.includes(status)) return reply.status(400).send({ success: false, error: "Invalid status" });

    const schedule = await prisma.schedule.update({ where: { id }, data: { status } });
    return reply.send({ success: true, data: schedule });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  fastify.delete("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.schedule.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
