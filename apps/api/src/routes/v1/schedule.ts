import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { maybeAutoConcludes } from "./scheduleHelpers.js";
import { requireModulePermission } from "../../utils/permissions.js";
import { expandWeekdayPlan, MAX_OCCURRENCES } from "../../utils/recurrence.js";
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

// "Add Multiple Schedules": one date range, and the chosen weekdays each with
// their own times. Deliberately does NOT extend scheduleSchema — there is no
// single date/startTime/endTime here, the per-day rows carry them.
const recurringSchema = z.object({
  academicYear: z.string().min(1),
  batchIds:     z.array(z.string()).min(1, "At least one batch required"),
  subjectId:    z.string().optional().nullable(),
  employeeId:   z.string().optional().nullable(),
  locationId:   z.string().optional().nullable(),
  mode:         z.enum(["ONLINE", "OFFLINE"]).optional().default("OFFLINE"),
  topics:       z.string().optional(),
  notes:        z.string().optional(),
  startDate:    z.string().min(1),
  endDate:      z.string().min(1),
  days: z.array(z.object({
    weekday:   z.number().int().min(0).max(6),
    startTime: z.string().min(1),
    endTime:   z.string().min(1),
  })).min(1, "Select at least one day"),
  /** Leave out occurrences where this faculty is already booked elsewhere. */
  skipConflicts: z.boolean().optional().default(false),
  /**
   * The submitter's UTC offset, as `Date.prototype.getTimezoneOffset()` reports
   * it (IST = -330). Without it the server would read "09:00" in its own zone —
   * prod runs UTC, so every class would land 5.5 hours late for Indian users.
   * Defaults to 0, i.e. treat the wall-clock time as UTC.
   */
  tzOffsetMinutes: z.number().int().min(-900).max(900).optional().default(0),
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
                        id: true, firstName: true, middleName: true, lastName: true,
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
            student: { select: { id: true, firstName: true, middleName: true, lastName: true, studentCode: true } },
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

  // ── MULTIPLE SCHEDULES ─────────────────────────────────────────────────────
  // Materialises one Schedule row per occurrence rather than storing a rule and
  // expanding on read: attendance, assignments and status are all per-class, so
  // every occurrence needs its own row. Rows are grouped by recurrenceId so the
  // set can be deleted as one.

  /**
   * Shared by /recurring and /recurring/preview so the classes and clashes the
   * user is shown come from exactly the code that will create them.
   */
  async function planSeries(d: z.infer<typeof recurringSchema>) {
    const occurrences = expandWeekdayPlan(d.startDate.slice(0, 10), d.endDate.slice(0, 10), d.days);
    if (occurrences.length === 0) {
      throw new Error("No classes fall in that date range — check the days you picked");
    }

    // Build stored instants from wall-clock strings in the SUBMITTER's zone, not
    // the server's — see tzOffsetMinutes above.
    const instant = (day: string, hhmm: string) => {
      const [y, mo, dd] = day.split("-").map(Number);
      const [hh, mi] = hhmm.split(":").map(Number);
      return new Date(Date.UTC(y, mo - 1, dd, hh, mi) + d.tzOffsetMinutes * 60_000);
    };

    // Faculty double-booking: same teacher, overlapping window, against a batch
    // they are not already teaching in that slot. Mirrors the single-class check.
    const conflicts: { date: string; startTime: string; batches: string }[] = [];
    if (d.employeeId) {
      const existing = await prisma.schedule.findMany({
        where: {
          employeeId: d.employeeId,
          status: { not: "CANCELLED" },
          date: {
            gte: new Date(occurrences[0].date),
            lte: new Date(occurrences[occurrences.length - 1].date),
          },
        },
        include: { batches: { include: { batch: { select: { name: true } } } } },
      });
      for (const o of occurrences) {
        const s0 = instant(o.date, o.startTime).getTime();
        const e0 = instant(o.date, o.endTime).getTime();
        for (const ex of existing) {
          if (ex.date.toISOString().slice(0, 10) !== o.date) continue;
          if (ex.batches.some((b) => d.batchIds.includes(b.batchId))) continue;
          if (s0 < ex.endTime.getTime() && e0 > ex.startTime.getTime()) {
            conflicts.push({
              date: o.date,
              startTime: o.startTime,
              batches: ex.batches.map((b) => b.batch?.name).filter(Boolean).join(", ") || "another batch",
            });
            break;
          }
        }
      }
    }

    return { occurrences, conflicts, instant, capped: occurrences.length >= MAX_OCCURRENCES };
  }

  fastify.post("/recurring/preview", async (request, reply) => {
    const parsed = recurringSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });
    try {
      const { occurrences, conflicts, capped } = await planSeries(parsed.data);
      return reply.send({
        success: true,
        data: { occurrences, count: occurrences.length, conflicts, capped },
      });
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message });
    }
  });

  fastify.post("/recurring", async (request, reply) => {
    const parsed = recurringSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    // tzOffsetMinutes is a transport concern, not a Schedule column — keep it out of `rest`.
    const { batchIds, startDate, endDate, days, skipConflicts, tzOffsetMinutes, ...rest } = parsed.data;

    let plan;
    try {
      plan = await planSeries(parsed.data);
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message });
    }
    const { occurrences, conflicts, instant, capped } = plan;

    const clashing = new Set(conflicts.map((c) => `${c.date}T${c.startTime}`));
    const toCreate = skipConflicts
      ? occurrences.filter((o) => !clashing.has(`${o.date}T${o.startTime}`))
      : occurrences;
    if (toCreate.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "Every class in that range clashes with an existing one for this faculty",
      });
    }

    const recurrenceId = randomUUID();
    await prisma.$transaction(
      toCreate.map((o) =>
        prisma.schedule.create({
          data: {
            ...rest,
            recurrenceId,
            date:      new Date(o.date),
            startTime: instant(o.date, o.startTime),
            endTime:   instant(o.date, o.endTime),
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
        occurrences: toCreate,
        conflicts,
        skipped: skipConflicts ? occurrences.length - toCreate.length : 0,
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
