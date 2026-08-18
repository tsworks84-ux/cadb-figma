import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { maybeAutoConcludes } from "./scheduleHelpers.js";
import { requireModulePermission } from "../../utils/permissions.js";
import { expandRecurrence, MAX_OCCURRENCES } from "../../utils/recurrence.js";
import { randomUUID } from "crypto";

const scheduleSchema = z.object({
  academicYear: z.string().min(1),
  batchIds:     z.array(z.string()).min(1, "At least one batch required"),
  subjectId:    z.string().optional().nullable(),
  employeeId:   z.string().optional().nullable(),
  locationId:   z.string().optional().nullable(),
  mode:         z.enum(["ONLINE", "OFFLINE"]).optional().default("OFFLINE"),
  date:         z.string().min(1),
  startTime:    z.string().min(1),
  endTime:      z.string().min(1),
  topics:       z.string().optional(),
  notes:        z.string().optional(),
});

const recurringSchema = scheduleSchema.extend({
  recurrence: z.object({
    frequency: z.enum(["DAILY", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "CUSTOM"]),
    // 0 = Sunday … 6 = Saturday.
    weekdays:  z.array(z.number().int().min(0).max(6)).optional(),
    until:     z.string().min(1),
  }),
  /** Leave out the occurrences where this faculty is already booked elsewhere. */
  skipConflicts: z.boolean().optional().default(false),
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
  attendances: { select: { isPresent: true } },
  assignments: {
    select: {
      id:          true,
      name:        true,
      submissions: { select: { status: true } },
    },
    take: 1,
  },
} as const;



export async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Schedule tab — STU_TIMETABLE, with attendance marking under STU_ATTENDANCE.
  fastify.addHook("preHandler", requireModulePermission((request) => {
    const url = request.url.split("?")[0];

    // "My upcoming lectures" on the home dashboard: a user listing their OWN
    // schedule isn't browsing Academics, so it stays open.
    if (request.method === "GET" && /^\/api\/v1\/academics\/schedules\/?$/.test(url)) {
      const { employeeId } = request.query as { employeeId?: string };
      if (employeeId && employeeId === (request.user as any)?.sub) return null;
    }

    if (url.includes("/attendance")) return "STU_ATTENDANCE";
    return "STU_TIMETABLE";
  }));

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

  // ── ATTENDANCE DETAIL ──────────────────────────────────────────────────────
  // Returns batch students + existing attendance records + linked assignment

  fastify.get("/:id/attendance-detail", async (request, reply) => {
    const { id } = request.params as any;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        batches: {
          include: {
            batch: {
              include: {
                studentBatches: {
                  where: { student: { isArchived: false, status: "ACTIVE" } },
                  orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
                  include: {
                    student: {
                      select: {
                        id: true, firstName: true, lastName: true,
                        studentCode: true, rollNumber: true, photoUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendances: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
          },
        },
        assignments: {
          include: {
            subject:  { select: { id: true, name: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
            batches:  { include: { batch: { select: { id: true, name: true } } } },
            submissions: { select: { id: true, status: true, studentId: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!schedule) return reply.status(404).send({ success: false, error: "Schedule not found" });

    // Deduplicate students across batches
    const studentMap = new Map<string, any>();
    for (const sb of schedule.batches) {
      for (const entry of (sb.batch as any).studentBatches ?? []) {
        studentMap.set(entry.student.id, entry.student);
      }
    }
    const batchStudents = [...studentMap.values()];

    return reply.send({ success: true, data: { ...schedule, batchStudents } });
  });

  // ── SAVE ATTENDANCE ────────────────────────────────────────────────────────

  fastify.post("/:id/attendance", async (request, reply) => {
    const role   = (request.user as any)?.role;
    const userId = (request.user as any)?.sub;
    // The plugin hook already proved the STU_ATTENDANCE/STU_TIMETABLE grant.
    // What's left is teacher scoping: an EMPLOYEE may only touch their own lecture.
    if (role === "EMPLOYEE") {
      const sched = await prisma.schedule.findUnique({ where: { id: (request.params as any).id }, select: { employeeId: true } });
      if (!sched || sched.employeeId !== userId) {
        return reply.status(403).send({ success: false, error: "Insufficient permissions" });
      }
    }
    const { id } = request.params as any;
    const { records } = request.body as {
      records: { studentId: string; isPresent: boolean; note?: string }[];
    };

    if (!Array.isArray(records) || records.length === 0) {
      return reply.status(400).send({ success: false, error: "records array required" });
    }

    await prisma.$transaction(
      records.map((r) =>
        prisma.scheduleAttendance.upsert({
          where: { scheduleId_studentId: { scheduleId: id, studentId: r.studentId } },
          create: { scheduleId: id, studentId: r.studentId, isPresent: r.isPresent, note: r.note ?? null },
          update: { isPresent: r.isPresent, note: r.note ?? null },
        })
      )
    );

    await maybeAutoConcludes(id);
    return reply.send({ success: true });
  });

  // ── DELETE ATTENDANCE RECORD ───────────────────────────────────────────────

  fastify.delete("/:id/attendance/:studentId", async (request, reply) => {
    const { id, studentId } = request.params as any;
    await prisma.scheduleAttendance.deleteMany({
      where: { scheduleId: id, studentId },
    });
    return reply.send({ success: true });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  fastify.post("/", async (request, reply) => {
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

  // ── RECURRING SERIES ───────────────────────────────────────────────────────
  // Materialises one Schedule row per occurrence rather than storing the rule
  // and expanding on read: attendance, assignments and status are all per-class,
  // so every occurrence needs somewhere to hang them. Rows are tied together by
  // recurrenceId so the series can be deleted as one.

  /**
   * Shared by /recurring and /recurring/preview so the dates and clashes the
   * user is shown are computed by exactly the code that will create them.
   */
  async function planSeries(d: z.infer<typeof recurringSchema>) {
    const { batchIds, date, startTime, endTime, recurrence, employeeId } = d;

    if (recurrence.frequency === "CUSTOM" && !recurrence.weekdays?.length) {
      throw new Error("Select at least one weekday");
    }
    const days = expandRecurrence(date.slice(0, 10), recurrence);
    if (days.length === 0) throw new Error("That pattern produces no classes");

    // Times arrive as full ISO instants on the first date; carry that wall-clock
    // time across to every occurrence.
    const startClock = new Date(startTime);
    const endClock   = new Date(endTime);
    const at = (day: string, clock: Date) =>
      new Date(`${day}T${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}:00`);

    // Faculty double-booking: same teacher, overlapping window, against a batch
    // they are not already teaching in that slot. Mirrors the modal's live check.
    const conflicts: { date: string; batches: string }[] = [];
    if (employeeId) {
      const existing = await prisma.schedule.findMany({
        where: {
          employeeId,
          status: { not: "CANCELLED" },
          date: { gte: new Date(days[0]), lte: new Date(days[days.length - 1]) },
        },
        include: { batches: { include: { batch: { select: { name: true } } } } },
      });
      for (const day of days) {
        const s0 = at(day, startClock).getTime();
        const e0 = at(day, endClock).getTime();
        for (const ex of existing) {
          if (ex.date.toISOString().slice(0, 10) !== day) continue;
          if (ex.batches.some((b) => batchIds.includes(b.batchId))) continue;
          if (s0 < ex.endTime.getTime() && e0 > ex.startTime.getTime()) {
            conflicts.push({
              date: day,
              batches: ex.batches.map((b) => b.batch?.name).filter(Boolean).join(", ") || "another batch",
            });
            break;
          }
        }
      }
    }
    return { days, conflicts, at, startClock, endClock, capped: days.length >= MAX_OCCURRENCES };
  }

  fastify.post("/recurring/preview", async (request, reply) => {
    const parsed = recurringSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });
    try {
      const { days, conflicts, capped } = await planSeries(parsed.data);
      return reply.send({ success: true, data: { dates: days, count: days.length, conflicts, capped } });
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message });
    }
  });

  fastify.post("/recurring", async (request, reply) => {
    const parsed = recurringSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { batchIds, date, startTime, endTime, recurrence, skipConflicts, ...rest } = parsed.data;

    let plan;
    try {
      plan = await planSeries(parsed.data);
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message });
    }
    const { days, conflicts, at, startClock, endClock, capped } = plan;

    const conflictDays = new Set(conflicts.map((c) => c.date));
    const toCreate = skipConflicts ? days.filter((day) => !conflictDays.has(day)) : days;
    if (toCreate.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "Every date in that series clashes with an existing class for this faculty",
      });
    }

    const recurrenceId = randomUUID();
    await prisma.$transaction(
      toCreate.map((day) =>
        prisma.schedule.create({
          data: {
            ...rest,
            recurrenceId,
            date:      new Date(day),
            startTime: at(day, startClock),
            endTime:   at(day, endClock),
            batches:   { create: batchIds.map((batchId) => ({ batchId })) },
          },
        })
      )
    );

    return reply.status(201).send({
      success: true,
      data: {
        recurrenceId,
        created: toCreate.length,
        dates: toCreate,
        conflicts,
        skipped: skipConflicts ? conflicts.length : 0,
        capped,
      },
    });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id", async (request, reply) => {
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
    const role   = (request.user as any)?.role;
    const userId = (request.user as any)?.sub;
    // The plugin hook already proved the STU_ATTENDANCE/STU_TIMETABLE grant.
    // What's left is teacher scoping: an EMPLOYEE may only touch their own lecture.
    if (role === "EMPLOYEE") {
      const sched = await prisma.schedule.findUnique({ where: { id: (request.params as any).id }, select: { employeeId: true } });
      if (!sched || sched.employeeId !== userId) {
        return reply.status(403).send({ success: false, error: "Insufficient permissions" });
      }
    }
    const { id } = request.params as any;
    const { status } = request.body as any;

    const valid = ["UPCOMING", "COMPLETED", "CONCLUDED", "CANCELLED"];
    if (!valid.includes(status)) return reply.status(400).send({ success: false, error: "Invalid status" });

    const schedule = await prisma.schedule.update({ where: { id }, data: { status } });
    return reply.send({ success: true, data: schedule });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  // `?scope=series` removes every remaining occurrence created by the same
  // recurrence rule — a 40-class series is otherwise 40 separate deletions.
  // Past occurrences are kept: they may already carry attendance.
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const { scope } = request.query as { scope?: string };

    if (scope === "series") {
      const target = await prisma.schedule.findUnique({ where: { id }, select: { recurrenceId: true } });
      if (!target) return reply.status(404).send({ success: false, error: "Schedule not found" });
      if (target.recurrenceId) {
        const today = new Date(new Date().toISOString().slice(0, 10));
        const { count } = await prisma.schedule.deleteMany({
          where: { recurrenceId: target.recurrenceId, date: { gte: today } },
        });
        return reply.send({ success: true, data: { deleted: count } });
      }
    }

    await prisma.schedule.delete({ where: { id } });
    return reply.send({ success: true, data: { deleted: 1 } });
  });
}
