import { type FastifyPluginAsync } from "fastify";
import { prisma } from "@cadb/db";
import { z } from "zod";
import ExcelJS from "exceljs";
import { getTeacherBatchIds } from "./teacherUtils.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireModulePermission } from "../../utils/permissions.js";

const examInclude = {
  subjects: {
    include: { subject: { select: { id: true, name: true } } },
    orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] as { paperNum?: "asc" | "desc"; subjectSlot?: "asc" | "desc" }[],
  },
  batches: {
    include: {
      batch: {
        select: {
          id: true, name: true, academicYear: true,
          locationId: true, location: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

// Each slot in the paper-subject matrix carries its own subjectId + topics
const slotSchema = z.object({
  subjectId: z.string().nullable().optional(),
  topics:    z.string().nullable().optional(),
  maxMarks:  z.number().nullable().optional(),
});

const examSchema = z.object({
  academicYear:  z.string().min(1),
  name:          z.string().min(1).max(40),
  numPapers:     z.number().int().min(1).max(5).optional(),
  numSubjects:   z.number().int().min(1).max(5).optional(),
  batchIds:      z.array(z.string()).min(1),
  paperSubjects: z.array(z.array(slotSchema)).optional(),
  examDate:      z.string(),
  startTime:     z.string().min(1),
  endTime:       z.string().min(1),
  totalMarks:    z.number().int().nullable().optional(),
  note:          z.string().nullable().optional(),
});

type Slot = z.infer<typeof slotSchema>;

function buildSubjectRows(paperSubjects: Slot[][], numPapers: number, numSubjects: number) {
  const rows: { paperNum: number; subjectSlot: number; subjectId: string | null; topics: string | null; maxMarks: number | null }[] = [];
  for (let p = 0; p < numPapers; p++) {
    for (let s = 0; s < numSubjects; s++) {
      const slot = paperSubjects[p]?.[s];
      rows.push({
        paperNum:    p + 1,
        subjectSlot: s + 1,
        subjectId:   slot?.subjectId || null,
        topics:      slot?.topics    || null,
        maxMarks:    slot?.maxMarks  ?? null,
      });
    }
  }
  return rows;
}

// ── Stats helper ──────────────────────────────────────────────────────────────

async function fetchStatsData(q: Record<string, string>) {
  const topN = Math.min(parseInt(q.topN ?? "10"), 100);

  const conditions: any[] = [];
  if (q.academicYear) conditions.push({ academicYear: q.academicYear });
  if (q.dateFrom || q.dateTo) {
    const df: any = {};
    if (q.dateFrom) df.gte = new Date(q.dateFrom);
    if (q.dateTo)   df.lte = new Date(q.dateTo);
    conditions.push({ examDate: df });
  }
  if (q.batchId)    conditions.push({ batches:  { some: { batchId:                 q.batchId    } } });
  if (q.gradeId)    conditions.push({ batches:  { some: { batch: { gradeId:        q.gradeId    } } } });
  if (q.subjectId)  conditions.push({ subjects: { some: { subjectId:               q.subjectId  } } });
  if (q.locationId) conditions.push({ batches:  { some: { batch: { locationId:     q.locationId } } } });
  if (q.examIds) {
    const ids = q.examIds.split(",").filter(Boolean);
    if (ids.length) conditions.push({ id: { in: ids } });
  }

  const exams = await prisma.exam.findMany({
    where: conditions.length ? { AND: conditions } : {},
    orderBy: { examDate: "asc" },
    include: {
      subjects: { include: { subject: { select: { id: true, name: true } } } },
      batches:  { include: { batch: { select: { id: true, name: true, grade: { select: { name: true } }, location: { select: { name: true } } } } } },
      results:  {
        where: { isExcluded: false },
        include: {
          marks: true,
          student: {
            select: {
              id: true, firstName: true, lastName: true, rollNumber: true,
              studentBatches: { select: { batchId: true, batch: { select: { id: true, name: true, grade: { select: { name: true } } } } } },
            },
          },
        },
      },
    },
  });

  // ── Per-exam trend ────────────────────────────────────────────────────────
  const trend = exams.map((exam) => {
    const appeared = exam.results.filter((r) => r.attended !== false);
    const totals   = appeared.map((r) => r.marks.reduce((s, m) => s + (m.marks ?? 0), 0));
    return {
      examId: exam.id, examName: exam.name, examDate: exam.examDate, totalMarks: exam.totalMarks,
      appeared: appeared.length,
      absent:   exam.results.filter((r) => r.attended === false).length,
      avg: totals.length ? +((totals.reduce((a, b) => a + b, 0)) / totals.length).toFixed(2) : null,
      max: totals.length ? Math.max(...totals) : null,
      min: totals.length ? Math.min(...totals) : null,
    };
  });

  // ── Per-student aggregation ───────────────────────────────────────────────
  const studentMap = new Map<string, { student: any; totals: number[] }>();
  for (const exam of exams) {
    for (const result of exam.results) {
      if (result.attended === false) continue;
      const total = result.marks.reduce((s, m) => s + (m.marks ?? 0), 0);
      if (!studentMap.has(result.studentId))
        studentMap.set(result.studentId, { student: result.student, totals: [] });
      studentMap.get(result.studentId)!.totals.push(total);
    }
  }
  const performers = [...studentMap.values()].map((e) => ({
    studentId:  e.student.id,
    name:       `${e.student.firstName} ${e.student.lastName}`,
    roll:       e.student.rollNumber ?? "—",
    batch:      e.student.studentBatches[0]?.batch?.name ?? "—",
    grade:      e.student.studentBatches[0]?.batch?.grade?.name ?? "—",
    examsCount: e.totals.length,
    avgTotal:   +((e.totals.reduce((a, b) => a + b, 0)) / e.totals.length).toFixed(2),
    maxTotal:   Math.max(...e.totals),
    minTotal:   Math.min(...e.totals),
  })).sort((a, b) => b.avgTotal - a.avgTotal);

  // ── Per-subject aggregation ───────────────────────────────────────────────
  const subjectMap = new Map<string, { name: string; marks: number[] }>();
  for (const exam of exams) {
    for (const es of exam.subjects) {
      if (!es.subjectId || !es.subject) continue;
      if (!subjectMap.has(es.subjectId))
        subjectMap.set(es.subjectId, { name: es.subject.name, marks: [] });
      for (const result of exam.results) {
        if (result.attended === false) continue;
        const m = result.marks.find((mk) => mk.paperNum === es.paperNum && mk.subjectSlot === es.subjectSlot);
        if (m?.marks != null) subjectMap.get(es.subjectId)!.marks.push(m.marks);
      }
    }
  }
  const subjectBreakdown = [...subjectMap.entries()].map(([sid, d]) => ({
    subjectId: sid, subjectName: d.name, count: d.marks.length,
    avg: d.marks.length ? +(d.marks.reduce((a, b) => a + b, 0) / d.marks.length).toFixed(2) : null,
    max: d.marks.length ? Math.max(...d.marks) : null,
    min: d.marks.length ? Math.min(...d.marks) : null,
  }));

  return {
    trend,
    topPerformers:    performers.slice(0, topN),
    lowPerformers:    [...performers].reverse().slice(0, topN),
    subjectBreakdown,
    summary: {
      totalExams:    exams.length,
      totalStudents: studentMap.size,
      overallAvg:    performers.length ? +(performers.reduce((s, p) => s + p.avgTotal, 0) / performers.length).toFixed(2) : null,
      overallMax:    performers.length ? Math.max(...performers.map((p) => p.maxTotal)) : null,
      overallMin:    performers.length ? Math.min(...performers.map((p) => p.minTotal)) : null,
    },
  };
}

// ── Excel styling helpers ────────────────────────────────────────────────────

function styleHeader(row: ExcelJS.Row, bgHex = "4338CA") {
  row.eachCell((cell) => {
    cell.font    = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgHex}` } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border  = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
  });
  row.height = 20;
}

function styleDataRow(row: ExcelJS.Row, even: boolean) {
  row.eachCell((cell) => {
    cell.font      = { size: 9 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: even ? "FFF6F7FE" : "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row.height = 16;
}

export const assessmentRoutes: FastifyPluginAsync = async (fastify) => {
  // These routes previously had no auth hook at all — anyone could read/write
  // assessment data unauthenticated.
  fastify.addHook("preHandler", authenticate);
  // Assessments tab — gated on the STU_ASSESSMENT grant (SUPER_ADMIN / HR_ADMIN bypass).
  fastify.addHook("preHandler", requireModulePermission("STU_ASSESSMENT"));

  // ── GET /stats ────────────────────────────────────────────────────────────
  fastify.get("/stats", async (req, reply) => {
    const q    = req.query as Record<string, string>;
    const data = await fetchStatsData(q);
    return reply.send({ success: true, data });
  });

  // ── GET /stats/excel ──────────────────────────────────────────────────────
  fastify.get("/stats/excel", async (req, reply) => {
    const q    = req.query as Record<string, string>;
    const data = await fetchStatsData(q);

    const wb = new ExcelJS.Workbook();
    wb.creator = "CADB – Centum Academy";

    const accentHex = "4338CA";

    // Helper: add a titled sheet with header + rows
    const buildSheet = (
      name: string,
      headers: string[],
      rows: (string | number | null)[][],
    ) => {
      const ws = wb.addWorksheet(name);
      ws.addRow(headers);
      styleHeader(ws.getRow(1), accentHex);
      rows.forEach((r, i) => {
        const row = ws.addRow(r);
        styleDataRow(row, i % 2 === 0);
      });
      // Auto-width (approx)
      ws.columns.forEach((col, idx) => {
        const maxLen = Math.max(
          headers[idx]?.length ?? 10,
          ...rows.map((r) => String(r[idx] ?? "").length),
        );
        col.width = Math.min(maxLen + 4, 40);
      });
      return ws;
    };

    // Sheet 1 – Exam Trend
    buildSheet(
      "Exam Trend",
      ["Exam", "Date", "Total Marks", "Appeared", "Absent", "Average", "Highest", "Lowest"],
      data.trend.map((t) => [
        t.examName,
        t.examDate ? new Date(t.examDate).toLocaleDateString("en-IN") : "",
        t.totalMarks ?? "—",
        t.appeared, t.absent,
        t.avg ?? "—", t.max ?? "—", t.min ?? "—",
      ]),
    );

    // Sheet 2 – Top Performers
    buildSheet(
      "Top Performers",
      ["Rank", "Roll No", "Name", "Batch", "Grade", "Exams", "Average", "Highest", "Lowest"],
      data.topPerformers.map((p, i) => [
        i + 1, p.roll, p.name, p.batch, p.grade, p.examsCount,
        p.avgTotal, p.maxTotal, p.minTotal,
      ]),
    );

    // Sheet 3 – Low Performers
    buildSheet(
      "Low Performers",
      ["Rank", "Roll No", "Name", "Batch", "Grade", "Exams", "Average", "Highest", "Lowest"],
      data.lowPerformers.map((p, i) => [
        i + 1, p.roll, p.name, p.batch, p.grade, p.examsCount,
        p.avgTotal, p.maxTotal, p.minTotal,
      ]),
    );

    // Sheet 4 – Subject Breakdown
    buildSheet(
      "Subject Breakdown",
      ["Subject", "Data Points", "Average", "Highest", "Lowest"],
      data.subjectBreakdown.map((s) => [
        s.subjectName, s.count,
        s.avg ?? "—", s.max ?? "—", s.min ?? "—",
      ]),
    );

    const buffer = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="assessment_stats.xlsx"`);
    return reply.send(Buffer.from(buffer));
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  fastify.get("/", async (req, reply) => {
    const q      = req.query as Record<string, string>;
    const limit  = Math.min(parseInt(q.limit  ?? "100"), 2000);
    const offset = parseInt(q.offset ?? "0");

    const where: any = {};
    if (q.search)       where.name         = { contains: q.search, mode: "insensitive" };
    if (q.status)       where.status       = q.status;
    if (q.academicYear) where.academicYear = q.academicYear;
    if (q.dateFrom || q.dateTo) {
      where.examDate = {};
      if (q.dateFrom) where.examDate.gte = new Date(q.dateFrom);
      if (q.dateTo)   where.examDate.lte = new Date(q.dateTo);
    }
    if (q.batchId)        where.batches  = { some: { batchId:          q.batchId   } };
    else if (q.teacherId) {
      const tBatchIds = await getTeacherBatchIds(q.teacherId);
      where.batches = { some: { batchId: { in: tBatchIds.length ? tBatchIds : ["__none__"] } } };
    }
    if (q.gradeId)   where.batches  = { some: { batch: { gradeId: q.gradeId   } } };
    if (q.subjectId) where.subjects = { some: { subjectId:        q.subjectId } };

    const [data, total] = await Promise.all([
      prisma.exam.findMany({ where, include: examInclude, orderBy: { examDate: "desc" }, skip: offset, take: limit }),
      prisma.exam.count({ where }),
    ]);

    return reply.send({ success: true, data, meta: { total, limit, offset } });
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  fastify.post("/", async (req, reply) => {
    const parsed = examSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message });

    const { batchIds, paperSubjects = [], note, examDate, totalMarks, numPapers = 1, numSubjects = 1, ...rest } = parsed.data;
    const subjectRows = buildSubjectRows(paperSubjects, numPapers, numSubjects);

    const exam = await prisma.exam.create({
      data: {
        ...rest,
        numPapers,
        numSubjects,
        examDate:   new Date(examDate),
        note:       note       ?? null,
        totalMarks: totalMarks ?? null,
        batches:    { create: batchIds.map((batchId) => ({ batchId })) },
        subjects:   { create: subjectRows },
      },
      include: examInclude,
    });

    return reply.status(201).send({ success: true, data: exam });
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────
  fastify.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = examSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message });

    const { batchIds, paperSubjects, note, examDate, totalMarks, numPapers, numSubjects, ...rest } = parsed.data;
    const updates: any = { ...rest };
    if (examDate    !== undefined) updates.examDate    = new Date(examDate);
    if (note        !== undefined) updates.note        = note       ?? null;
    if (totalMarks  !== undefined) updates.totalMarks  = totalMarks ?? null;
    if (numPapers   !== undefined) updates.numPapers   = numPapers;
    if (numSubjects !== undefined) updates.numSubjects = numSubjects;

    const exam = await prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.examBatch.deleteMany({ where: { examId: id } });
        updates.batches = { create: batchIds.map((batchId) => ({ batchId })) };
      }
      if (paperSubjects !== undefined) {
        const current = await tx.exam.findUnique({ where: { id }, select: { numPapers: true, numSubjects: true } });
        const np = numPapers   ?? current?.numPapers   ?? 1;
        const ns = numSubjects ?? current?.numSubjects ?? 1;
        await tx.examSubject.deleteMany({ where: { examId: id } });
        updates.subjects = { create: buildSubjectRows(paperSubjects, np, ns) };
      }
      return tx.exam.update({ where: { id }, data: updates, include: examInclude });
    });

    return reply.send({ success: true, data: exam });
  });

  // ── PATCH /:id/status ─────────────────────────────────────────────────────
  fastify.patch("/:id/status", async (req, reply) => {
    const { id }     = req.params as { id: string };
    const { status } = req.body   as { status: string };
    const valid = ["DUE", "COMPLETED", "MARKED", "CANCELLED", "ARCHIVED"];
    if (!valid.includes(status)) return reply.status(400).send({ success: false, error: "Invalid status" });
    const exam = await prisma.exam.update({ where: { id }, data: { status: status as any } });
    return reply.send({ success: true, data: exam });
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  fastify.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.exam.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── GET /:id — single exam detail ─────────────────────────────────────────
  fastify.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const exam = await prisma.exam.findUnique({ where: { id }, include: examInclude });
    if (!exam) return reply.status(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: exam });
  });

  // ── GET /:id/results — auto-init & return student results ─────────────────
  fastify.get("/:id/results", async (req, reply) => {
    const { id } = req.params as { id: string };

    const exam = await prisma.exam.findUnique({
      where: { id },
      select: { batches: { select: { batchId: true } } },
    });
    if (!exam) return reply.status(404).send({ success: false, error: "Not found" });

    const batchIds = exam.batches.map((b) => b.batchId);
    const students = await prisma.student.findMany({
      where: { studentBatches: { some: { batchId: { in: batchIds } } }, isArchived: false },
      select: {
        id: true, firstName: true, lastName: true, rollNumber: true,
        studentBatches: { where: { batchId: { in: batchIds } }, select: { batchId: true, batch: { select: { id: true, name: true } } }, take: 1 },
      },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
    });

    if (students.length > 0) {
      await prisma.examResult.createMany({
        data: students.map((s) => ({ examId: id, studentId: s.id })),
        skipDuplicates: true,
      });
    }

    const results = await prisma.examResult.findMany({
      where: { examId: id },
      include: {
        marks: { orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] },
      },
    });
    const resultMap = new Map(results.map((r) => [r.studentId, r]));

    const data = students.map((s) => ({ student: s, result: resultMap.get(s.id) ?? null }));
    return reply.send({ success: true, data });
  });

  // ── POST /:id/results/bulk — save all marks + attendance ──────────────────
  fastify.post("/:id/results/bulk", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { updates } = req.body as {
      updates: Array<{
        studentId: string;
        attended: boolean;
        marks: Array<{ paperNum: number; subjectSlot: number; marks: number | null }>;
      }>;
    };
    if (!Array.isArray(updates) || updates.length === 0) return reply.send({ success: true });

    await prisma.$transaction(async (tx) => {
      // Ensure result rows exist
      await tx.examResult.createMany({
        data: updates.map((u) => ({ examId: id, studentId: u.studentId })),
        skipDuplicates: true,
      });
      // Update attendance per student
      await Promise.all(
        updates.map((u) =>
          tx.examResult.updateMany({
            where: { examId: id, studentId: u.studentId },
            data: { attended: u.attended },
          })
        )
      );
      // Get result IDs
      const results = await tx.examResult.findMany({
        where: { examId: id, studentId: { in: updates.map((u) => u.studentId) } },
        select: { id: true, studentId: true },
      });
      const resultIdMap = new Map(results.map((r) => [r.studentId, r.id]));
      // Delete old marks and recreate
      await tx.examMark.deleteMany({ where: { examResultId: { in: results.map((r) => r.id) } } });
      const markRows = updates.flatMap((u) => {
        const resultId = resultIdMap.get(u.studentId);
        if (!resultId) return [];
        return u.marks
          .filter((m) => m.marks != null)
          .map((m) => ({ examResultId: resultId, paperNum: m.paperNum, subjectSlot: m.subjectSlot, marks: m.marks! }));
      });
      if (markRows.length > 0) await tx.examMark.createMany({ data: markRows });
    });

    return reply.send({ success: true });
  });

  // ── PATCH /:id/results/:studentId — toggle exclusion ──────────────────────
  fastify.patch("/:id/results/:studentId", async (req, reply) => {
    const { id, studentId } = req.params as { id: string; studentId: string };
    const { isExcluded } = req.body as { isExcluded: boolean };
    await prisma.examResult.upsert({
      where:  { examId_studentId: { examId: id, studentId } },
      create: { examId: id, studentId, isExcluded },
      update: { isExcluded },
    });
    return reply.send({ success: true });
  });
};
