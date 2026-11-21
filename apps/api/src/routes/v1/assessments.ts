import { type FastifyPluginAsync } from "fastify";
import { prisma } from "@cadb/db";
import { z } from "zod";
import ExcelJS from "exceljs";
import { getTeacherBatchIds } from "./teacherUtils.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireModulePermission } from "../../utils/permissions.js";
import { fullName } from "../../utils/name.js";
import { syncExamStages, actorFor } from "../../utils/examTracking.js";
import { notifyAssignments } from "./exams.js";
import {
  buildMarksTemplate, loadWorkbook, parseMarksWorkbook, slotKey,
  type ExamSlot, type TemplateStudent,
} from "../../utils/marksImport.js";

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

// ── Exam layout: paper → sections → subjects → question ranges ──────────────
// See ExamLayout in @cadb/types. When a request carries a layout, the ExamSubject
// rows, numPapers, numSubjects and totalMarks are all derived from it here.
const QUESTION_TYPES = ["SCQ", "MCQ", "NAT", "INTEGER", "MATRIX", "ASSERTION", "PARAGRAPH", "SUBJECTIVE"] as const;

const rangeSchema = z.object({
  from:     z.number().int().min(1).max(999),
  to:       z.number().int().min(1).max(999),
  type:     z.enum(QUESTION_TYPES),
  marks:    z.number().positive("Marks per question must be more than 0").max(1000),
  negative: z.number().min(0, "Negative marks are entered as a positive number").max(1000),
}).refine((r) => r.to >= r.from, { message: "A question range must end at or after where it starts" });

const layoutSchema = z.object({
  papers: z.array(z.object({
    sections: z.array(z.object({
      name: z.string().trim().max(40).default(""),
      subjects: z.array(z.object({
        subjectId: z.string().nullable(),
        topics:    z.string().nullable().optional(),
        maxMarks:  z.number().min(0).nullable().optional(),
        ranges:    z.array(rangeSchema).max(30),
      })).min(1, "Every section needs at least one subject").max(10),
    })).min(1, "Every paper needs at least one section").max(10),
  })).min(1).max(10),
}).superRefine((layout, ctx) => {
  // Question numbers may restart per section (some papers number each subject
  // from 1), but can't overlap within one.
  layout.papers.forEach((paper, pi) => paper.sections.forEach((sec, si) => {
    const ranges = sec.subjects.flatMap((s) => s.ranges).sort((a, b) => a.from - b.from);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].from <= ranges[i - 1].to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Paper ${pi + 1}, ${sec.name || `Section ${si + 1}`}: Q${ranges[i].from}–${ranges[i].to} overlaps Q${ranges[i - 1].from}–${ranges[i - 1].to}`,
        });
        return;
      }
    }
  }));
});

type Layout = z.infer<typeof layoutSchema>;
type SubjectRow = { paperNum: number; subjectSlot: number; subjectId: string | null; topics: string | null; maxMarks: number | null };

function subjectMaxMarks(s: Layout["papers"][number]["sections"][number]["subjects"][number]) {
  if (s.ranges.length === 0) return s.maxMarks ?? null;
  return s.ranges.reduce((n, r) => n + (r.to - r.from + 1) * r.marks, 0);
}

/**
 * One marks slot per distinct subject within a paper, in order of first
 * appearance — Physics in Section A and again in Section B is one column whose
 * max marks are the two added together. Unpicked subjects each keep their own slot.
 */
function slotsFromLayout(layout: Layout) {
  const rows: SubjectRow[] = [];
  layout.papers.forEach((paper, pi) => {
    const paperRows: SubjectRow[] = [];
    for (const sec of paper.sections) {
      for (const sub of sec.subjects) {
        const max = subjectMaxMarks(sub);
        const topics = sub.topics?.trim() || null;
        const same = sub.subjectId ? paperRows.find((r) => r.subjectId === sub.subjectId) : undefined;
        if (same) {
          same.maxMarks = same.maxMarks == null && max == null ? null : (same.maxMarks ?? 0) + (max ?? 0);
          if (topics) same.topics = same.topics ? `${same.topics}, ${topics}` : topics;
        } else {
          paperRows.push({ paperNum: pi + 1, subjectSlot: paperRows.length + 1, subjectId: sub.subjectId, topics, maxMarks: max });
        }
      }
    }
    rows.push(...paperRows);
  });
  const numSubjects = Math.max(1, ...layout.papers.map((_, pi) => rows.filter((r) => r.paperNum === pi + 1).length));
  const maxes = rows.map((r) => r.maxMarks).filter((m): m is number => m != null);
  const totalMarks = maxes.length ? Math.round(maxes.reduce((a, b) => a + b, 0)) : null;
  return { rows, numPapers: layout.papers.length, numSubjects, totalMarks };
}

/** A template keeps the pattern, not this sitting's syllabus. */
function stripTopics(layout: Layout): Layout {
  return { papers: layout.papers.map((p) => ({ sections: p.sections.map((sec) => ({ ...sec, subjects: sec.subjects.map(({ topics: _t, ...sub }) => sub) })) })) };
}

/** <4 letters><ddmmyy>, where the date part is the exam's own date. */
const examCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}\d{6}$/, "Exam code must be 4 letters followed by the exam date as ddmmyy, e.g. JMWT211126");

function codeDateSuffix(examDate: string) {
  const d = new Date(examDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCFullYear() % 100)}`;
}

const codeConflict = (code: string) => ({ success: false, error: `Exam code ${code} is already used by another exam` });

/** Which unique column a P2002 hit — `code` on Exam, `name` on ExamTemplate. */
const uniqueTarget = (e: any): string => String(e?.meta?.target ?? "");

const examSchema = z.object({
  academicYear:  z.string().min(1),
  name:          z.string().min(1).max(40),
  code:          examCodeSchema.nullable().optional(),
  layout:        layoutSchema.optional(),
  numPapers:     z.number().int().min(1).max(10).optional(),
  numSubjects:   z.number().int().min(1).max(20).optional(),
  batchIds:      z.array(z.string()).min(1),
  paperSubjects: z.array(z.array(slotSchema)).optional(),
  examDate:      z.string(),
  startTime:     z.string().min(1),
  endTime:       z.string().min(1),
  totalMarks:    z.number().int().nullable().optional(),
  note:          z.string().nullable().optional(),
});

// Creating an exam can also save its paper/subject grid as a named template.
const createExamSchema = examSchema.extend({
  saveAsTemplate: z.string().trim().min(1, "Template name is required").max(40, "Template name cannot exceed 40 characters").optional(),
});

type Slot = z.infer<typeof slotSchema>;

const templateInclude = {
  subjects: {
    include: { subject: { select: { id: true, name: true } } },
    orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] as { paperNum?: "asc" | "desc"; subjectSlot?: "asc" | "desc" }[],
  },
} as const;

/** Case-insensitive, so "JEE Weekly" and "jee weekly" can't both exist. */
async function templateNameTaken(name: string) {
  const hit = await prisma.examTemplate.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return !!hit;
}

const templateNameConflict = (name: string) => ({ success: false, error: `A template named "${name}" already exists — pick another name` });

function buildSubjectRows(paperSubjects: Slot[][], numPapers: number, numSubjects: number) {
  const rows: SubjectRow[] = [];
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
              id: true, firstName: true, middleName: true, lastName: true, rollNumber: true,
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
    name:       fullName(e.student),
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

/**
 * Alphabetical by the name shown on screen. Sorted in JS rather than by Prisma
 * because the roll number came first before (leaving the list in no order a
 * person could follow when roll numbers are blank) and because a DB sort would
 * order ALL-CAPS names apart from Title Case ones under some collations.
 */
const byStudentName = (
  a: { firstName: string; middleName?: string | null; lastName: string | null },
  b: { firstName: string; middleName?: string | null; lastName: string | null },
) => fullName(a).localeCompare(fullName(b), "en", { sensitivity: "base", numeric: true });

export const assessmentRoutes: FastifyPluginAsync = async (fastify) => {
  // These routes previously had no auth hook at all — anyone could read/write
  // assessment data unauthenticated.
  fastify.addHook("preHandler", authenticate);
  // Assessments tab — gated on the STU_ASSESSMENT grant; only SUPER_ADMIN bypasses.
  fastify.addHook("preHandler", requireModulePermission("STU_ASSESSMENT", {
    // Marks, attendance and exclusions all write to an exam that already exists,
    // so they are an edit of that exam's data. Without this the bulk save (a POST)
    // would demand canCreate — the grant for adding new exams, which a role that
    // only marks papers has no reason to hold.
    actionFor: (request) => {
      const url = request.routeOptions?.url ?? request.url;
      const writesResults = url.includes("/results") || url.includes("/marks-import");
      return writesResults && request.method !== "GET" ? "canEdit" : null;
    },
  }));

  /**
   * Everything the template writer and the importer both need: the exam, its
   * paper/subject slots in display order, its students (alphabetical, matching
   * the marks grid) and whatever is already saved for them.
   */
  async function loadMarksContext(examId: string) {
    const exam = await prisma.exam.findUnique({
      where:  { id: examId },
      select: {
        id: true, name: true, examDate: true, totalMarks: true, numPapers: true, numSubjects: true,
        batches:  { select: { batchId: true } },
        subjects: {
          select: { paperNum: true, subjectSlot: true, maxMarks: true, subject: { select: { name: true } } },
          orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }],
        },
      },
    });
    if (!exam) return null;

    const batchIds = exam.batches.map((b) => b.batchId);
    const students = await prisma.student.findMany({
      where: { studentBatches: { some: { batchId: { in: batchIds } } }, isArchived: false },
      select: {
        id: true, firstName: true, middleName: true, lastName: true, rollNumber: true,
        studentBatches: { where: { batchId: { in: batchIds } }, select: { batch: { select: { name: true } } }, take: 1 },
      },
    });
    students.sort(byStudentName);

    const results = await prisma.examResult.findMany({
      where:  { examId },
      select: { studentId: true, attended: true, isExcluded: true, marks: { select: { paperNum: true, subjectSlot: true, marks: true } } },
    });
    const resultMap = new Map(results.map((r) => [r.studentId, r]));
    const excluded  = new Set(results.filter((r) => r.isExcluded).map((r) => r.studentId));

    const slots: ExamSlot[] = exam.subjects.map((es) => ({
      paperNum:    es.paperNum,
      subjectSlot: es.subjectSlot,
      subjectName: es.subject?.name ?? null,
      maxMarks:    es.maxMarks,
    }));

    // Students taken off the exam aren't markable, so they stay out of the file.
    return { exam, slots, students: students.filter((s) => !excluded.has(s.id)), resultMap, excluded };
  }

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

    // The stat cards count everything the other sidebar filters match, not just the
    // page in hand — counting the page made "Due for Marking" top out at the
    // page size and drop to 0 under the Due chip.
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    // The status chip is left out too: the cards summarise every status.
    const { status: _status, ...countsWhere } = where;

    // Toolbar search: test name, batch or subject. Server-side, because the list
    // is paged — filtering only the loaded page hid any test outside it (an
    // older exam date under "All" with more than one page of tests).
    const listWhere: any = { ...where };
    const term = (q.q ?? "").trim();
    if (term) {
      listWhere.AND = [{
        OR: [
          { name:     { contains: term, mode: "insensitive" } },
          { code:     { contains: term, mode: "insensitive" } },
          { batches:  { some: { batch:   { name: { contains: term, mode: "insensitive" } } } } },
          { subjects: { some: { subject: { name: { contains: term, mode: "insensitive" } } } } },
        ],
      }];
    }

    const [data, total, upcoming, dueForMarking, completed] = await Promise.all([
      prisma.exam.findMany({ where: listWhere, include: examInclude, orderBy: { examDate: "desc" }, skip: offset, take: limit }),
      prisma.exam.count({ where: listWhere }),
      prisma.exam.count({ where: { AND: [countsWhere, { status: "DUE", examDate: { gte: startOfToday } }] } }),
      prisma.exam.count({ where: { AND: [countsWhere, { status: "COMPLETED" }] } }),
      prisma.exam.count({ where: { AND: [countsWhere, { status: "MARKED" }] } }),
    ]);

    return reply.send({
      success: true, data,
      meta: { total, limit, offset, counts: { upcoming, dueForMarking, completed } },
    });
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  fastify.post("/", async (req, reply) => {
    const parsed = createExamSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message });

    const { batchIds, paperSubjects = [], note, examDate, layout, code, saveAsTemplate, ...rest } = parsed.data;
    let { totalMarks, numPapers = 1, numSubjects = 1 } = parsed.data;
    let subjectRows: SubjectRow[];
    if (layout) {
      const derived = slotsFromLayout(layout);
      subjectRows = derived.rows;
      ({ numPapers, numSubjects } = derived);
      totalMarks = derived.totalMarks ?? totalMarks ?? null;
    } else {
      subjectRows = buildSubjectRows(paperSubjects, numPapers, numSubjects);
    }
    delete (rest as any).numPapers; delete (rest as any).numSubjects; delete (rest as any).totalMarks;

    if (code) {
      if (!code.endsWith(codeDateSuffix(examDate))) {
        return reply.status(400).send({ success: false, error: `Exam code must end with the exam date as ddmmyy (${codeDateSuffix(examDate)})` });
      }
      if (await prisma.exam.findUnique({ where: { code }, select: { id: true } })) return reply.status(409).send(codeConflict(code));
    }

    // Checked before anything is written, so a clashing template name can't leave
    // behind an exam the user believes failed to save.
    if (saveAsTemplate && await templateNameTaken(saveAsTemplate)) {
      return reply.status(409).send(templateNameConflict(saveAsTemplate));
    }

    try {
      const exam = await prisma.$transaction(async (tx) => {
        const created = await tx.exam.create({
          data: {
            ...rest,
            code:       code ?? null,
            layout:     layout ?? undefined,
            numPapers,
            numSubjects,
            examDate:   new Date(examDate),
            note:       note       ?? null,
            totalMarks: totalMarks ?? null,
            // Untracked exams show marks as soon as they're entered, as before.
            // Setting up exam tracking clears this until results are released.
            resultsReleasedAt: new Date(),
            batches:    { create: batchIds.map((batchId) => ({ batchId })) },
            subjects:   { create: subjectRows },
          },
          include: examInclude,
        });
        if (saveAsTemplate) {
          // The pattern only — topics are this sitting's syllabus, not the template's.
          await tx.examTemplate.create({
            data: {
              name: saveAsTemplate, numPapers, numSubjects, totalMarks: totalMarks ?? null,
              layout: layout ? stripTopics(layout) : undefined,
              subjects: { create: subjectRows.map(({ topics: _topics, ...row }) => row) },
            },
          });
        }
        return created;
      });
      return reply.status(201).send({ success: true, data: exam });
    } catch (e: any) {
      // Both were checked above; a P2002 here means one was taken in between.
      if (e?.code === "P2002" && code && uniqueTarget(e).includes("code")) return reply.status(409).send(codeConflict(code));
      if (e?.code === "P2002" && saveAsTemplate) return reply.status(409).send(templateNameConflict(saveAsTemplate));
      throw e;
    }
  });

  // ── Exam templates ────────────────────────────────────────────────────────
  // Saved from the create form (saveAsTemplate above). Static paths, so they win
  // over the /:id routes below regardless of registration order.
  fastify.get("/templates", async (_req, reply) => {
    const data = await prisma.examTemplate.findMany({ include: templateInclude, orderBy: { name: "asc" } });
    return reply.send({ success: true, data });
  });

  // Save a pattern on its own, without creating an exam (the form's "Save as Template").
  const templateSchema = z.object({
    name:   z.string().trim().min(1, "Template name is required").max(40, "Template name cannot exceed 40 characters"),
    layout: layoutSchema,
  });
  fastify.post("/templates", async (req, reply) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message });
    const { name } = parsed.data;
    const layout = stripTopics(parsed.data.layout);
    if (!layout.papers.some((p) => p.sections.some((s) => s.subjects.some((sub) => sub.subjectId)))) {
      return reply.status(400).send({ success: false, error: "Pick at least one subject before saving this as a template" });
    }
    if (await templateNameTaken(name)) return reply.status(409).send(templateNameConflict(name));
    const { rows, numPapers, numSubjects, totalMarks } = slotsFromLayout(layout);
    try {
      const data = await prisma.examTemplate.create({
        data: {
          name, numPapers, numSubjects, totalMarks, layout,
          subjects: { create: rows.map(({ topics: _topics, ...row }) => row) },
        },
        include: templateInclude,
      });
      return reply.status(201).send({ success: true, data });
    } catch (e: any) {
      if (e?.code === "P2002") return reply.status(409).send(templateNameConflict(name));
      throw e;
    }
  });

  fastify.delete("/templates/:templateId", async (req, reply) => {
    const { templateId } = req.params as { templateId: string };
    const { count } = await prisma.examTemplate.deleteMany({ where: { id: templateId } });
    if (!count) return reply.status(404).send({ success: false, error: "Template not found" });
    return reply.send({ success: true });
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────
  fastify.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = examSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message });

    const { batchIds, paperSubjects, note, examDate, totalMarks, numPapers, numSubjects, layout, code, ...rest } = parsed.data;
    const updates: any = { ...rest };

    if (code !== undefined) {
      updates.code = code;
      if (code) {
        const date = examDate ?? (await prisma.exam.findUnique({ where: { id }, select: { examDate: true } }))?.examDate.toISOString();
        if (date && !code.endsWith(codeDateSuffix(date))) {
          return reply.status(400).send({ success: false, error: `Exam code must end with the exam date as ddmmyy (${codeDateSuffix(date)})` });
        }
        const clash = await prisma.exam.findUnique({ where: { code }, select: { id: true } });
        if (clash && clash.id !== id) return reply.status(409).send(codeConflict(code));
      }
    }
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
      if (layout) {
        const derived = slotsFromLayout(layout);
        Object.assign(updates, {
          layout, numPapers: derived.numPapers, numSubjects: derived.numSubjects,
          totalMarks: derived.totalMarks ?? totalMarks ?? null,
        });
        await tx.examSubject.deleteMany({ where: { examId: id } });
        updates.subjects = { create: derived.rows };
      } else if (paperSubjects !== undefined) {
        const current = await tx.exam.findUnique({ where: { id }, select: { numPapers: true, numSubjects: true } });
        const np = numPapers   ?? current?.numPapers   ?? 1;
        const ns = numSubjects ?? current?.numSubjects ?? 1;
        await tx.examSubject.deleteMany({ where: { examId: id } });
        updates.subjects = { create: buildSubjectRows(paperSubjects, np, ns) };
      }
      return tx.exam.update({ where: { id }, data: updates, include: examInclude });
    }).catch((e: any) => {
      if (e?.code === "P2002" && code && uniqueTarget(e).includes("code")) return null;
      throw e;
    });
    if (!exam) return reply.status(409).send(codeConflict(code!));

    // A tracked exam's stages follow its date and subject grid.
    const tracked = await prisma.exam.findUnique({ where: { id }, select: { examTypeId: true } });
    if (tracked?.examTypeId && (examDate !== undefined || paperSubjects !== undefined || numPapers !== undefined || layout !== undefined)) {
      const actor = await actorFor((req.user as any).sub);
      const sync = await syncExamStages(prisma, id, actor);
      await notifyAssignments(id, sync);
    }

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
        id: true, firstName: true, middleName: true, lastName: true, rollNumber: true,
        studentBatches: { where: { batchId: { in: batchIds } }, select: { batchId: true, batch: { select: { id: true, name: true } } }, take: 1 },
      },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
    });
    students.sort(byStudentName);

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

  // ── GET /:id/marks-template — the xlsx the user fills in ──────────────────
  // Pre-filled with this exam's students and whatever marks are already saved,
  // so the file round-trips: download, edit a column, upload, nothing else moves.
  fastify.get("/:id/marks-template", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await loadMarksContext(id);
    if (!ctx) return reply.status(404).send({ success: false, error: "Not found" });

    const wb = buildMarksTemplate(
      { name: ctx.exam.name, examDate: ctx.exam.examDate, totalMarks: ctx.exam.totalMarks, numPapers: ctx.exam.numPapers },
      ctx.slots,
      ctx.students.map<TemplateStudent>((s) => ({
        id:         s.id,
        rollNumber: s.rollNumber,
        name:       fullName(s),
        batchName:  s.studentBatches[0]?.batch?.name ?? "",
        attended:   ctx.resultMap.get(s.id)?.attended ?? true,
        marks:      Object.fromEntries(
          (ctx.resultMap.get(s.id)?.marks ?? []).map((m) => [slotKey(m.paperNum, m.subjectSlot), m.marks]),
        ),
      })),
    );

    const buf = await wb.xlsx.writeBuffer();
    const safeName = ctx.exam.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="marks_${safeName}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── POST /:id/marks-import — upload the filled template ───────────────────
  // `dryRun` validates and previews without writing (the UI always calls it
  // first). Without it the file is applied in one transaction; only the students
  // named in the file are touched, so a partial sheet is a partial update, never
  // a wipe of everyone else.
  fastify.post("/:id/marks-import", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q      = req.query as any;
    const dryRun      = q.dryRun === "true" || q.dryRun === true;
    const skipInvalid = q.skipInvalid === "true" || q.skipInvalid === true;

    const ctx = await loadMarksContext(id);
    if (!ctx) return reply.status(404).send({ success: false, error: "Not found" });

    const upload = await req.file().catch(() => null);
    if (!upload) return reply.status(400).send({ success: false, error: "No file was uploaded" });
    if (!/\.(xlsx|csv)$/i.test(upload.filename)) {
      return reply.status(400).send({ success: false, error: "Upload the .xlsx template (or a .csv with the same columns)" });
    }

    let buffer: Buffer;
    try {
      buffer = await upload.toBuffer();
    } catch {
      return reply.status(400).send({ success: false, error: "The file is larger than 5 MB" });
    }

    let workbook;
    try {
      workbook = await loadWorkbook(buffer, upload.filename);
    } catch {
      return reply.status(400).send({ success: false, error: "That file could not be read as a spreadsheet. Use the template from this exam." });
    }

    const { rows, errors, totalRows } = parseMarksWorkbook(
      workbook, ctx.slots, ctx.exam.numPapers, ctx.exam.totalMarks,
      ctx.students.map((s) => ({
        id: s.id, rollNumber: s.rollNumber, name: fullName(s),
        // Blank Present cells keep this rather than resetting to present.
        savedAttended: ctx.resultMap.get(s.id)?.attended ?? null,
      })),
    );

    // A row naming a student who was taken off this exam gets a message that says
    // so, rather than the parser's "not a student in this exam".
    const kept = rows.filter((r) => {
      if (!ctx.excluded.has(r.studentId)) return true;
      errors.push({ row: r.row, column: "Student", message: `${r.name} was removed from this exam — restore them first` });
      return false;
    });
    rows.length = 0;
    rows.push(...kept);

    if (dryRun) {
      return reply.send({
        success: true,
        data: {
          dryRun: true,
          totalRows,
          validRows: rows.length,
          errors,
          preview: rows.slice(0, 10).map((r) => ({
            row: r.row, name: r.name, attended: r.attended, total: r.total,
          })),
        },
      });
    }

    if (!totalRows) {
      return reply.status(400).send({ success: false, error: "The sheet has no student rows" });
    }
    if (errors.length && !skipInvalid) {
      return reply.status(400).send({
        success: false,
        error: `${errors.length} problem${errors.length === 1 ? "" : "s"} found — nothing was imported`,
        data: { totalRows, validRows: rows.length, errors },
      });
    }
    if (!rows.length) {
      return reply.status(400).send({ success: false, error: "No valid rows to import", data: { totalRows, validRows: 0, errors } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.examResult.createMany({
        data: rows.map((r) => ({ examId: id, studentId: r.studentId })),
        skipDuplicates: true,
      });
      await Promise.all(rows.map((r) =>
        tx.examResult.updateMany({
          where: { examId: id, studentId: r.studentId },
          data:  { attended: r.attended },
        })
      ));

      const results = await tx.examResult.findMany({
        where:  { examId: id, studentId: { in: rows.map((r) => r.studentId) } },
        select: { id: true, studentId: true },
      });
      const resultIdMap = new Map(results.map((r) => [r.studentId, r.id]));

      await tx.examMark.deleteMany({ where: { examResultId: { in: results.map((r) => r.id) } } });
      const markRows = rows.flatMap((r) => {
        const resultId = resultIdMap.get(r.studentId);
        if (!resultId) return [];
        return r.marks
          .filter((m) => m.marks != null)
          .map((m) => ({ examResultId: resultId, paperNum: m.paperNum, subjectSlot: m.subjectSlot, marks: m.marks! }));
      });
      if (markRows.length > 0) await tx.examMark.createMany({ data: markRows });
    });

    return reply.send({
      success: true,
      data: {
        imported: rows.length,
        skipped:  totalRows - rows.length,
        errors,
        students: rows.map((r) => ({ name: r.name, total: r.total, attended: r.attended })),
      },
    });
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
