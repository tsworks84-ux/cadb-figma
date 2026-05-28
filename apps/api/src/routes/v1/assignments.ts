import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { maybeAutoConcludes } from "./scheduleHelpers.js";
import { createWriteStream, unlinkSync } from "fs";
import { pipeline } from "stream/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "../../../uploads");

const assignmentSchema = z.object({
  academicYear:   z.string().min(1),
  name:           z.string().min(1),
  assignmentDate: z.string().min(1),
  submissionDate: z.string().min(1),
  batchIds:       z.array(z.string()).min(1, "At least one batch required"),
  subjectId:      z.string().optional().nullable(),
  employeeId:     z.string().optional().nullable(),
  scheduleId:     z.string().optional().nullable(),
  topics:         z.string().optional().nullable(),
  note:           z.string().optional().nullable(),
});

const assignmentInclude = {
  subject:  { select: { id: true, code: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  batches:  {
    include: {
      batch: {
        select: {
          id: true, name: true, academicYear: true, gradeId: true,
          grade:    { select: { id: true, name: true } },
          locationId: true,
          location: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

function requireAdmin(request: any, reply: any) {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
}

export async function assignmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── LIST ───────────────────────────────────────────────────────────────────

  fastify.get("/", async (request, reply) => {
    const {
      search, status, dateFrom, dateTo,
      academicYear, batchId, gradeId, subjectId, employeeId,
      page = "1", limit = "50",
    } = request.query as any;

    const where: any = {};

    if (status && status !== "ALL") where.status = status;
    if (academicYear)  where.academicYear = academicYear;
    if (subjectId)     where.subjectId    = subjectId;
    if (employeeId)    where.employeeId   = employeeId;

    if (search) where.name = { contains: search, mode: "insensitive" };

    if (dateFrom || dateTo) {
      where.submissionDate = {};
      if (dateFrom) where.submissionDate.gte = new Date(dateFrom);
      if (dateTo)   where.submissionDate.lte = new Date(dateTo);
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

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ submissionDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: parseInt(limit),
      }),
      prisma.assignment.count({ where }),
    ]);

    return reply.send({ success: true, data: assignments, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  });

  // ── STATS ──────────────────────────────────────────────────────────────────
  // Must be before /:id so Fastify doesn't match "stats" as an id param.

  fastify.get("/stats", async (request, reply) => {
    const { academicYear, dateFrom, dateTo, batchId, subjectId, gradeId } = request.query as any;

    const assignmentWhere: any = {};
    if (academicYear) assignmentWhere.academicYear = academicYear;
    if (subjectId)    assignmentWhere.subjectId    = subjectId;
    if (dateFrom || dateTo) {
      assignmentWhere.assignmentDate = {};
      if (dateFrom) assignmentWhere.assignmentDate.gte = new Date(dateFrom);
      if (dateTo)   assignmentWhere.assignmentDate.lte = new Date(dateTo);
    }
    if (batchId || gradeId) {
      assignmentWhere.batches = {
        some: {
          ...(batchId ? { batchId } : {}),
          ...(gradeId ? { batch: { gradeId } } : {}),
        },
      };
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignment: assignmentWhere },
      select: {
        status:      true,
        submittedAt: true,
        updatedAt:   true,
        studentId:   true,
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            studentCode: true, rollNumber: true,
            studentBatches: {
              select: {
                batchId: true,
                batch: { select: { id: true, name: true, locationId: true, location: { select: { id: true, name: true } } } },
              },
              take: 1,
            },
          },
        },
      },
    });

    // ── Per-student aggregation ────────────────────────────────────────────
    type StudentStat = { id: string; name: string; code: string; rollNumber: string; batchId: string; batchName: string; cityId: string; cityName: string; total: number; submitted: number };
    const studentMap = new Map<string, StudentStat>();
    for (const sub of submissions) {
      const s = sub.student;
      const firstBatch = (s as any).studentBatches?.[0];
      if (!studentMap.has(s.id)) {
        studentMap.set(s.id, {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          code: s.studentCode,
          rollNumber: s.rollNumber ?? "",
          batchId:   firstBatch?.batchId ?? "",
          batchName: firstBatch?.batch?.name ?? "—",
          cityId:    firstBatch?.batch?.locationId ?? "",
          cityName:  firstBatch?.batch?.location?.name ?? "—",
          total: 0, submitted: 0,
        });
      }
      const e = studentMap.get(s.id)!;
      e.total++;
      if (sub.status !== "NOT_SUBMITTED") e.submitted++;
    }

    // ── Per-batch aggregation ──────────────────────────────────────────────
    type BatchStat = { id: string; name: string; cityId: string; cityName: string; total: number; submitted: number };
    const batchMap = new Map<string, BatchStat>();
    for (const sub of submissions) {
      const s = sub.student;
      const firstBatch = (s as any).studentBatches?.[0];
      const bid = firstBatch?.batchId ?? "__none__";
      if (!batchMap.has(bid)) {
        batchMap.set(bid, {
          id: bid, name: firstBatch?.batch?.name ?? "—",
          cityId:   firstBatch?.batch?.locationId ?? "",
          cityName: firstBatch?.batch?.location?.name ?? "—",
          total: 0, submitted: 0,
        });
      }
      const e = batchMap.get(bid)!;
      e.total++;
      if (sub.status !== "NOT_SUBMITTED") e.submitted++;
    }

    // ── Per-city aggregation ───────────────────────────────────────────────
    const cityMap = new Map<string, { id: string; name: string; total: number; submitted: number }>();
    for (const sub of submissions) {
      const s = sub.student;
      const firstBatchC = (s as any).studentBatches?.[0];
      const cid = firstBatchC?.batch?.locationId ?? "__none__";
      if (!cityMap.has(cid)) cityMap.set(cid, { id: cid, name: firstBatchC?.batch?.location?.name ?? "—", total: 0, submitted: 0 });
      const e = cityMap.get(cid)!;
      e.total++;
      if (sub.status !== "NOT_SUBMITTED") e.submitted++;
    }

    // ── Weekly submission trend ────────────────────────────────────────────
    const weekMap = new Map<string, { week: string; label: string; submitted: number }>();
    for (const sub of submissions) {
      if (sub.status === "NOT_SUBMITTED") continue;
      const d = new Date(sub.submittedAt ?? sub.updatedAt);
      const day  = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const ws   = new Date(d); ws.setDate(diff); ws.setHours(0, 0, 0, 0);
      const key  = ws.toISOString().split("T")[0];
      const lbl  = `${ws.getDate()}/${ws.getMonth() + 1}`;
      if (!weekMap.has(key)) weekMap.set(key, { week: key, label: lbl, submitted: 0 });
      weekMap.get(key)!.submitted++;
    }

    return reply.send({
      success: true,
      data: {
        studentStats:      [...studentMap.values()],
        batchStats:        [...batchMap.values()],
        cityStats:         [...cityMap.values()],
        weeklySubmissions: [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week)),
      },
    });
  });

  // ── GET ONE ────────────────────────────────────────────────────────────────

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const assignment = await prisma.assignment.findUnique({ where: { id }, include: assignmentInclude });
    if (!assignment) return reply.status(404).send({ success: false, error: "Assignment not found" });
    return reply.send({ success: true, data: assignment });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  fastify.post("/", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = assignmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { batchIds, assignmentDate, submissionDate, subjectId, employeeId, scheduleId, note, topics, ...rest } = parsed.data;

    const assignment = await prisma.assignment.create({
      data: {
        ...rest,
        subjectId:      subjectId  || null,
        employeeId:     employeeId || null,
        scheduleId:     scheduleId || null,
        topics:         topics     || null,
        note:           note       || null,
        assignmentDate: new Date(assignmentDate),
        submissionDate: new Date(submissionDate),
        batches:        { create: batchIds.map((batchId) => ({ batchId })) },
      },
      include: assignmentInclude,
    });

    if (scheduleId) await maybeAutoConcludes(scheduleId);

    return reply.status(201).send({ success: true, data: assignment });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = assignmentSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { batchIds, assignmentDate, submissionDate, subjectId, employeeId, scheduleId, note, topics, ...rest } = parsed.data;

    const assignment = await prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.assignmentBatch.deleteMany({ where: { assignmentId: id } });
      }
      return tx.assignment.update({
        where: { id },
        data: {
          ...rest,
          ...(subjectId  !== undefined ? { subjectId:  subjectId  || null } : {}),
          ...(employeeId !== undefined ? { employeeId: employeeId || null } : {}),
          ...(scheduleId !== undefined ? { scheduleId: scheduleId || null } : {}),
          ...(topics     !== undefined ? { topics:     topics     || null } : {}),
          ...(note       !== undefined ? { note:       note       || null } : {}),
          ...(assignmentDate ? { assignmentDate: new Date(assignmentDate) } : {}),
          ...(submissionDate ? { submissionDate: new Date(submissionDate) } : {}),
          ...(batchIds ? { batches: { create: batchIds.map((batchId) => ({ batchId })) } } : {}),
        },
        include: assignmentInclude,
      });
    });

    return reply.send({ success: true, data: assignment });
  });

  // ── STATUS ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id/status", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const { status } = request.body as any;

    const valid = ["DUE", "COMPLETED", "ARCHIVED"];
    if (!valid.includes(status)) return reply.status(400).send({ success: false, error: "Invalid status" });

    const assignment = await prisma.assignment.update({ where: { id }, data: { status } });
    return reply.send({ success: true, data: assignment });
  });

  // ── ATTACHMENT UPLOAD ──────────────────────────────────────────────────────

  fastify.post("/:id/attachment", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;

    const existing = await prisma.assignment.findUnique({ where: { id }, select: { attachmentUrl: true } });
    if (!existing) return reply.status(404).send({ success: false, error: "Assignment not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ success: false, error: "No file uploaded" });

    const ext      = data.filename.split(".").pop() ?? "bin";
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOADS_DIR, fileName);

    await pipeline(data.file, createWriteStream(filePath));

    if (existing.attachmentUrl) {
      try { unlinkSync(join(UPLOADS_DIR, existing.attachmentUrl.replace("/uploads/", ""))); } catch {}
    }

    const assignment = await prisma.assignment.update({
      where: { id },
      data: { attachmentUrl: `/uploads/${fileName}`, attachmentName: data.filename },
    });
    return reply.send({ success: true, data: { attachmentUrl: assignment.attachmentUrl, attachmentName: assignment.attachmentName } });
  });

  // ── SUBMISSIONS LIST ───────────────────────────────────────────────────────
  // Returns all students from the assignment's batches with their submission
  // status. Students no longer in any of those batches are flagged as removed.

  fastify.get("/:id/submissions", async (request, reply) => {
    const { id } = request.params as any;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        batches: { select: { batchId: true } },
        submissions: {
          include: {
            student: {
              select: {
                id: true, firstName: true, lastName: true,
                studentCode: true, rollNumber: true,
                studentBatches: { select: { batchId: true }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!assignment) return reply.status(404).send({ success: false, error: "Assignment not found" });

    const batchIds = assignment.batches.map((b) => b.batchId);

    // All active students currently in these batches
    const currentStudents = await prisma.student.findMany({
      where: { studentBatches: { some: { batchId: { in: batchIds } } }, isArchived: false },
      select: { id: true, firstName: true, lastName: true, studentCode: true, rollNumber: true, studentBatches: { select: { batchId: true }, take: 1 } },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
    });

    const submissionMap = new Map(assignment.submissions.map((s) => [s.studentId, s]));
    const currentIds    = new Set(currentStudents.map((s) => s.id));

    // Auto-create missing submission records for current students
    const missing = currentStudents.filter((s) => !submissionMap.has(s.id));
    if (missing.length > 0) {
      await prisma.assignmentSubmission.createMany({
        data: missing.map((s) => ({ assignmentId: id, studentId: s.id })),
        skipDuplicates: true,
      });
      // Re-fetch updated submissions
      const fresh = await prisma.assignmentSubmission.findMany({
        where: { assignmentId: id, studentId: { in: missing.map((s) => s.id) } },
      });
      for (const s of fresh) submissionMap.set(s.studentId, s as any);
    }

    const current = currentStudents.map((s) => ({
      ...submissionMap.get(s.id),
      student: s,
    }));

    // Students who have a submission but are no longer in the batch
    const removed = assignment.submissions
      .filter((sub) => !currentIds.has(sub.studentId))
      .map((sub) => ({ ...sub }));

    return reply.send({ success: true, data: { current, removed } });
  });

  // ── UPDATE SUBMISSION ──────────────────────────────────────────────────────

  fastify.patch("/:id/submissions/:studentId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id: assignmentId, studentId } = request.params as any;
    const { status, reviewNote } = request.body as any;

    const VALID = ["NOT_SUBMITTED", "SUBMITTED", "IN_PROCESS", "APPROVED", "REJECTED"];
    if (status && !VALID.includes(status)) {
      return reply.status(400).send({ success: false, error: "Invalid status" });
    }

    const data: any = { updatedAt: new Date() };
    if (status)     data.status     = status;
    if (status === "SUBMITTED" && !data.submittedAt) data.submittedAt = new Date();
    if (reviewNote !== undefined) data.reviewNote = reviewNote || null;

    const submission = await prisma.assignmentSubmission.upsert({
      where:  { assignmentId_studentId: { assignmentId, studentId } },
      create: { assignmentId, studentId, ...data },
      update: data,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true, rollNumber: true } },
      },
    });
    return reply.send({ success: true, data: submission });
  });

  // ── SUBMISSION ATTACHMENT ──────────────────────────────────────────────────

  fastify.post("/:id/submissions/:studentId/attachment", async (request, reply) => {
    requireAdmin(request, reply);
    const { id: assignmentId, studentId } = request.params as any;

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      select: { attachmentUrl: true },
    });

    const file = await request.file();
    if (!file) return reply.status(400).send({ success: false, error: "No file uploaded" });

    const ext      = file.filename.split(".").pop() ?? "bin";
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOADS_DIR, fileName);
    await pipeline(file.file, createWriteStream(filePath));

    if (existing?.attachmentUrl) {
      try { unlinkSync(join(UPLOADS_DIR, existing.attachmentUrl.replace("/uploads/", ""))); } catch {}
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where:  { assignmentId_studentId: { assignmentId, studentId } },
      create: { assignmentId, studentId, attachmentUrl: `/uploads/${fileName}`, attachmentName: file.filename, status: "SUBMITTED", submittedAt: new Date() },
      update: { attachmentUrl: `/uploads/${fileName}`, attachmentName: file.filename },
    });
    return reply.send({ success: true, data: { attachmentUrl: submission.attachmentUrl, attachmentName: submission.attachmentName } });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  fastify.delete("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { attachmentUrl: true } });
    if (assignment?.attachmentUrl) {
      try { unlinkSync(join(UPLOADS_DIR, assignment.attachmentUrl.replace("/uploads/", ""))); } catch {}
    }
    await prisma.assignment.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
