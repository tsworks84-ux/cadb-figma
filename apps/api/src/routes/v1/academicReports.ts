import { type FastifyPluginAsync } from "fastify";
import { prisma } from "@cadb/db";
import ExcelJS from "exceljs";

// ── Excel helpers ─────────────────────────────────────────────────────────────

const INDIGO  = "FF4338CA";
const LIGHT   = "FFF6F7FE";
const WHITE   = "FFFFFFFF";
const GRAY_TXT = "FF6B7280";

function titleRow(ws: ExcelJS.Worksheet, text: string, span: number) {
  ws.mergeCells(`A1:${colLetter(span)}1`);
  const c = ws.getCell("A1");
  c.value     = text;
  c.font      = { bold: true, size: 12, color: { argb: WHITE } };
  c.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
  c.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;
}

function headerRow(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font      = { bold: true, size: 9, color: { argb: WHITE } };
    c.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border    = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
  });
  row.height = 18;
}

function dataRow(row: ExcelJS.Row, idx: number) {
  row.eachCell((c) => {
    c.font      = { size: 9 };
    c.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? LIGHT : WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  row.height = 15;
}

function autoWidths(ws: ExcelJS.Worksheet, cols: number[]) {
  ws.columns.forEach((col, i) => { col.width = cols[i] ?? 15; });
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export const academicReportsRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /batch-performance ─────────────────────────────────────────────────
  // Excel: 3 sheets — Exam Summary, Student Rankings, Detailed Marks Matrix
  fastify.get("/batch-performance", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (!q.academicYear) return reply.status(400).send({ success: false, error: "academicYear is required" });

    const conds: any[] = [{ academicYear: q.academicYear }];
    if (q.batchId)  conds.push({ batches: { some: { batchId: q.batchId } } });
    if (q.gradeId)  conds.push({ batches: { some: { batch: { gradeId: q.gradeId } } } });
    if (q.dateFrom || q.dateTo) {
      const df: any = {};
      if (q.dateFrom) df.gte = new Date(q.dateFrom);
      if (q.dateTo)   df.lte = new Date(q.dateTo);
      conds.push({ examDate: df });
    }

    const exams = await prisma.exam.findMany({
      where: { AND: conds },
      orderBy: { examDate: "asc" },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } } },
        batches:  { include: { batch: { select: { name: true, grade: { select: { name: true } } } } } },
        results:  {
          where:   { isExcluded: false },
          include: {
            marks:   true,
            student: { select: { id: true, firstName: true, lastName: true, rollNumber: true, batch: { select: { name: true } } } },
          },
        },
      },
    });

    // Per-exam stats
    const examStats = exams.map((exam) => {
      const appeared = exam.results.filter((r) => r.attended !== false);
      const totals   = appeared.map((r) => r.marks.reduce((s, m) => s + (m.marks ?? 0), 0));
      return {
        id: exam.id, name: exam.name, date: exam.examDate, totalMarks: exam.totalMarks,
        appeared: appeared.length, absent: exam.results.filter((r) => r.attended === false).length,
        avg:  totals.length ? +((totals.reduce((a, b) => a + b, 0)) / totals.length).toFixed(2) : null,
        max:  totals.length ? Math.max(...totals) : null,
        min:  totals.length ? Math.min(...totals) : null,
      };
    });

    // Per-student aggregation
    const studentMap = new Map<string, { student: any; scores: { examId: string; name: string; total: number; totalMarks: number | null; attended: boolean }[] }>();
    for (const exam of exams) {
      for (const r of exam.results) {
        if (!studentMap.has(r.studentId))
          studentMap.set(r.studentId, { student: r.student, scores: [] });
        studentMap.get(r.studentId)!.scores.push({
          examId: exam.id, name: exam.name,
          total: r.marks.reduce((s, m) => s + (m.marks ?? 0), 0),
          totalMarks: exam.totalMarks, attended: r.attended !== false,
        });
      }
    }
    const students = [...studentMap.values()].map((e) => {
      const att = e.scores.filter((s) => s.attended);
      return {
        s: e.student, scores: e.scores, attended: att.length,
        absent: e.scores.length - att.length,
        avg: att.length ? +(att.reduce((s, sc) => s + sc.total, 0) / att.length).toFixed(2) : 0,
      };
    }).sort((a, b) => b.avg - a.avg);

    const data = { examStats, students: students.map((s) => ({ ...s.s, scores: s.scores, attended: s.attended, absent: s.absent, avg: s.avg })), exams: exams.map((e) => ({ id: e.id, name: e.name })) };

    if (q.format !== "excel") return reply.send({ success: true, data });

    // ── Excel ──────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook(); wb.creator = "CADB";

    // Sheet 1: Exam Summary
    const ws1 = wb.addWorksheet("Exam Summary");
    titleRow(ws1, `Batch Performance Report — ${q.academicYear}`, 8);
    const hr1 = ws1.addRow(["Exam", "Date", "Total Marks", "Appeared", "Absent", "Average", "Highest", "Lowest"]);
    headerRow(hr1);
    examStats.forEach((e, i) => {
      dataRow(ws1.addRow([e.name, fmtDate(e.date), e.totalMarks ?? "—", e.appeared, e.absent, e.avg ?? "—", e.max ?? "—", e.min ?? "—"]), i);
    });
    autoWidths(ws1, [30, 16, 14, 12, 12, 12, 12, 12]);

    // Sheet 2: Student Rankings
    const ws2 = wb.addWorksheet("Student Rankings");
    titleRow(ws2, "Student Rankings (by Average Marks)", 6);
    headerRow(ws2.addRow(["Rank", "Roll No", "Name", "Batch", "Exams Appeared", "Average Marks"]));
    students.forEach((s, i) => {
      dataRow(ws2.addRow([i + 1, s.s.rollNumber ?? "—", `${s.s.firstName} ${s.s.lastName}`, s.s.batch?.name ?? "—", s.attended, s.avg]), i);
    });
    autoWidths(ws2, [8, 14, 28, 20, 16, 16]);

    // Sheet 3: Detailed Matrix (student × exam)
    const ws3 = wb.addWorksheet("Detailed Marks");
    const matrixCols = 2 + exams.length + 1;
    titleRow(ws3, "Detailed Marks Matrix", matrixCols);
    headerRow(ws3.addRow(["Roll No", "Name", ...exams.map((e) => e.name.slice(0, 18)), "Average"]));
    students.forEach((s, i) => {
      dataRow(ws3.addRow([
        s.s.rollNumber ?? "—",
        `${s.s.firstName} ${s.s.lastName}`,
        ...exams.map((ex) => {
          const sc = s.scores.find((x) => x.examId === ex.id);
          if (!sc) return "—";
          return sc.attended ? sc.total : "A";
        }),
        s.avg,
      ]), i);
    });
    ws3.columns.forEach((col) => { col.width = 16; });
    ws3.getColumn(2).width = 28;

    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="batch_performance_${q.academicYear.replace(/\//g, "-")}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── GET /student-progress ──────────────────────────────────────────────────
  fastify.get("/student-progress", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (!q.studentId) return reply.status(400).send({ success: false, error: "studentId is required" });

    const conds: any[] = [];
    if (q.academicYear) conds.push({ academicYear: q.academicYear });
    if (q.dateFrom || q.dateTo) {
      const df: any = {};
      if (q.dateFrom) df.gte = new Date(q.dateFrom);
      if (q.dateTo)   df.lte = new Date(q.dateTo);
      conds.push({ examDate: df });
    }
    conds.push({ results: { some: { studentId: q.studentId, isExcluded: false } } });

    const [student, exams] = await Promise.all([
      prisma.student.findUnique({
        where: { id: q.studentId },
        select: { id: true, firstName: true, lastName: true, rollNumber: true, batch: { select: { name: true, grade: { select: { name: true } }, location: { select: { name: true } } } } },
      }),
      prisma.exam.findMany({
        where: { AND: conds },
        orderBy: { examDate: "asc" },
        include: {
          subjects: { include: { subject: { select: { id: true, name: true } } } },
          results:  {
            where:   { studentId: q.studentId, isExcluded: false },
            include: { marks: true },
          },
        },
      }),
    ]);

    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const examHistory = exams.map((exam) => {
      const result  = exam.results[0];
      const attended = result?.attended !== false;
      const total   = attended ? (result?.marks ?? []).reduce((s, m) => s + (m.marks ?? 0), 0) : null;
      const pct     = total != null && exam.totalMarks ? +((total / exam.totalMarks) * 100).toFixed(1) : null;
      const slotMarks = exam.subjects.map((es) => {
        const m = result?.marks?.find((mk) => mk.paperNum === es.paperNum && mk.subjectSlot === es.subjectSlot);
        return { subjectName: es.subject?.name ?? `S${es.subjectSlot}`, marks: attended ? (m?.marks ?? null) : null, maxMarks: es.maxMarks };
      });
      return { examId: exam.id, examName: exam.name, examDate: exam.examDate, totalMarks: exam.totalMarks, attended, total, pct, slotMarks };
    });

    // Subject aggregation
    const subMap = new Map<string, { name: string; marks: number[] }>();
    for (const eh of examHistory) {
      if (!eh.attended) continue;
      for (const sm of eh.slotMarks) {
        if (sm.marks == null) continue;
        if (!subMap.has(sm.subjectName)) subMap.set(sm.subjectName, { name: sm.subjectName, marks: [] });
        subMap.get(sm.subjectName)!.marks.push(sm.marks);
      }
    }
    const subjectSummary = [...subMap.values()].map((d) => ({
      subject: d.name, count: d.marks.length,
      avg: +(d.marks.reduce((a, b) => a + b, 0) / d.marks.length).toFixed(2),
      max: Math.max(...d.marks), min: Math.min(...d.marks),
    }));

    const data = { student, examHistory, subjectSummary };

    if (q.format !== "excel") return reply.send({ success: true, data });

    // ── Excel ──────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook(); wb.creator = "CADB";

    // Sheet 1: Exam History
    const ws1 = wb.addWorksheet("Exam History");
    titleRow(ws1, `Student Progress — ${student.firstName} ${student.lastName}`, 6);
    // Student info block
    const infoRows = [
      ["Name", `${student.firstName} ${student.lastName}`],
      ["Roll No", student.rollNumber ?? "—"],
      ["Batch", student.batch?.name ?? "—"],
      ["Grade", student.batch?.grade?.name ?? "—"],
      ["Centre", student.batch?.location?.name ?? "—"],
    ];
    infoRows.forEach(([k, v]) => {
      const r = ws1.addRow([k, v]);
      r.getCell(1).font = { bold: true, size: 9, color: { argb: GRAY_TXT } };
      r.getCell(2).font = { bold: true, size: 9 };
      r.height = 14;
    });
    ws1.addRow([]);

    const hr1 = ws1.addRow(["Exam", "Date", "Total Marks", "Obtained", "Percentage", "Attended"]);
    headerRow(hr1);
    examHistory.forEach((e, i) => {
      dataRow(ws1.addRow([e.examName, fmtDate(e.examDate), e.totalMarks ?? "—", e.total ?? "Absent", e.pct != null ? `${e.pct}%` : "—", e.attended ? "Yes" : "No"]), i);
    });
    autoWidths(ws1, [32, 16, 14, 14, 14, 12]);

    // Sheet 2: Subject Summary
    const ws2 = wb.addWorksheet("Subject Summary");
    titleRow(ws2, "Subject-wise Performance", 5);
    headerRow(ws2.addRow(["Subject", "Exams", "Average", "Highest", "Lowest"]));
    subjectSummary.forEach((s, i) => {
      dataRow(ws2.addRow([s.subject, s.count, s.avg, s.max, s.min]), i);
    });
    autoWidths(ws2, [28, 12, 14, 14, 14]);

    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="student_progress_${student.firstName}_${student.lastName}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── GET /exam-attendance ───────────────────────────────────────────────────
  fastify.get("/exam-attendance", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (!q.academicYear) return reply.status(400).send({ success: false, error: "academicYear is required" });

    const conds: any[] = [{ academicYear: q.academicYear }];
    if (q.batchId)  conds.push({ batches: { some: { batchId: q.batchId } } });
    if (q.gradeId)  conds.push({ batches: { some: { batch: { gradeId: q.gradeId } } } });
    if (q.examIds) {
      const ids = q.examIds.split(",").filter(Boolean);
      if (ids.length) conds.push({ id: { in: ids } });
    }
    if (q.dateFrom || q.dateTo) {
      const df: any = {};
      if (q.dateFrom) df.gte = new Date(q.dateFrom);
      if (q.dateTo)   df.lte = new Date(q.dateTo);
      conds.push({ examDate: df });
    }

    const exams = await prisma.exam.findMany({
      where: { AND: conds }, orderBy: { examDate: "asc" },
      include: {
        results: {
          where:   { isExcluded: false },
          include: { student: { select: { id: true, firstName: true, lastName: true, rollNumber: true, batch: { select: { name: true } } } } },
        },
      },
    });

    const data = exams.map((exam) => ({
      examId: exam.id, examName: exam.name, examDate: exam.examDate,
      appeared: exam.results.filter((r) => r.attended !== false).length,
      absent:   exam.results.filter((r) => r.attended === false).length,
      total:    exam.results.length,
      students: exam.results.map((r) => ({
        name:   `${r.student.firstName} ${r.student.lastName}`,
        roll:   r.student.rollNumber ?? "—",
        batch:  r.student.batch?.name ?? "—",
        attended: r.attended !== false,
      })).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    if (q.format !== "excel") return reply.send({ success: true, data });

    const wb = new ExcelJS.Workbook(); wb.creator = "CADB";

    for (const exam of data) {
      const ws = wb.addWorksheet(exam.examName.slice(0, 30));
      titleRow(ws, `Attendance — ${exam.examName} (${fmtDate(exam.examDate)})`, 4);
      // Summary row
      const sumRow = ws.addRow([`Appeared: ${exam.appeared}`, `Absent: ${exam.absent}`, `Total: ${exam.total}`, `Rate: ${exam.total ? ((exam.appeared / exam.total) * 100).toFixed(1) : 0}%`]);
      sumRow.eachCell((c) => { c.font = { bold: true, size: 9, color: { argb: INDIGO } }; });
      sumRow.height = 16;
      ws.addRow([]);
      headerRow(ws.addRow(["Roll No", "Name", "Batch", "Status"]));
      exam.students.forEach((s, i) => {
        const r = ws.addRow([s.roll, s.name, s.batch, s.attended ? "Present" : "Absent"]);
        dataRow(r, i);
        if (!s.attended) r.getCell(4).font = { size: 9, bold: true, color: { argb: "FFEF4444" } };
      });
      autoWidths(ws, [14, 28, 20, 12]);
    }

    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="exam_attendance_${q.academicYear.replace(/\//g, "-")}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── GET /subject-analysis ──────────────────────────────────────────────────
  fastify.get("/subject-analysis", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (!q.subjectId) return reply.status(400).send({ success: false, error: "subjectId is required" });

    const conds: any[] = [{ subjects: { some: { subjectId: q.subjectId } } }];
    if (q.academicYear) conds.push({ academicYear: q.academicYear });
    if (q.gradeId)  conds.push({ batches: { some: { batch: { gradeId: q.gradeId } } } });
    if (q.batchId)  conds.push({ batches: { some: { batchId: q.batchId } } });
    if (q.dateFrom || q.dateTo) {
      const df: any = {};
      if (q.dateFrom) df.gte = new Date(q.dateFrom);
      if (q.dateTo)   df.lte = new Date(q.dateTo);
      conds.push({ examDate: df });
    }

    const exams = await prisma.exam.findMany({
      where: { AND: conds }, orderBy: { examDate: "asc" },
      include: {
        subjects: { where: { subjectId: q.subjectId }, include: { subject: { select: { name: true } } } },
        batches:  { include: { batch: { select: { name: true } } } },
        results:  {
          where:   { isExcluded: false },
          include: {
            marks:   true,
            student: { select: { id: true, firstName: true, lastName: true, rollNumber: true, batch: { select: { name: true } } } },
          },
        },
      },
    });

    const subjectName = exams[0]?.subjects[0]?.subject?.name ?? "Subject";

    const examData = exams.map((exam) => {
      const es = exam.subjects[0];
      if (!es) return null;
      const marks: { student: any; marks: number | null; attended: boolean }[] = [];
      for (const result of exam.results) {
        if (result.attended === false) { marks.push({ student: result.student, marks: null, attended: false }); continue; }
        const m = result.marks.find((mk) => mk.paperNum === es.paperNum && mk.subjectSlot === es.subjectSlot);
        marks.push({ student: result.student, marks: m?.marks ?? null, attended: true });
      }
      const valid = marks.filter((m) => m.attended && m.marks != null).map((m) => m.marks!);
      return {
        examId: exam.id, examName: exam.name, examDate: exam.examDate, maxMarks: es.maxMarks,
        appeared: marks.filter((m) => m.attended).length,
        avg: valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : null,
        max: valid.length ? Math.max(...valid) : null,
        min: valid.length ? Math.min(...valid) : null,
        marks,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof exams[0]["subjects"][0]>> extends never ? never : any[];

    const data = { subjectName, examData };
    if (q.format !== "excel") return reply.send({ success: true, data });

    const wb = new ExcelJS.Workbook(); wb.creator = "CADB";

    // Sheet 1: Exam-wise summary
    const ws1 = wb.addWorksheet("Exam Summary");
    titleRow(ws1, `Subject Analysis — ${subjectName}`, 6);
    headerRow(ws1.addRow(["Exam", "Date", "Max Marks", "Appeared", "Average", "Highest", "Lowest"]));
    examData.forEach((e, i) => {
      dataRow(ws1.addRow([e.examName, fmtDate(e.examDate), e.maxMarks ?? "—", e.appeared, e.avg ?? "—", e.max ?? "—", e.min ?? "—"]), i);
    });
    autoWidths(ws1, [32, 16, 14, 12, 12, 12, 12]);

    // Sheet 2: Per-student breakdown
    const ws2 = wb.addWorksheet("Student Breakdown");
    titleRow(ws2, `Student-wise Marks — ${subjectName}`, 2 + examData.length + 1);
    headerRow(ws2.addRow(["Roll No", "Name", ...examData.map((e) => e.examName.slice(0, 16)), "Average"]));
    // Aggregate students
    const stuMap = new Map<string, { s: any; scores: (number | null | "A")[] }>();
    examData.forEach((exam, ei) => {
      exam.marks.forEach((m: any) => {
        const sid = m.student.id;
        if (!stuMap.has(sid)) stuMap.set(sid, { s: m.student, scores: new Array(examData.length).fill("—") });
        const scores = stuMap.get(sid)!.scores;
        scores[ei] = m.attended ? (m.marks ?? "—") : "A";
      });
    });
    [...stuMap.values()].forEach((entry, i) => {
      const valid = entry.scores.filter((s): s is number => typeof s === "number");
      const avg   = valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : "—";
      dataRow(ws2.addRow([entry.s.rollNumber ?? "—", `${entry.s.firstName} ${entry.s.lastName}`, ...entry.scores, avg]), i);
    });
    ws2.columns.forEach((c) => { c.width = 14; });
    ws2.getColumn(2).width = 28;

    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="subject_analysis_${subjectName.replace(/\s+/g, "_")}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── GET /assignment-completion ─────────────────────────────────────────────
  fastify.get("/assignment-completion", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (!q.academicYear) return reply.status(400).send({ success: false, error: "academicYear is required" });

    const conds: any[] = [{ academicYear: q.academicYear }];
    if (q.batchId)   conds.push({ batches:  { some: { batchId: q.batchId } } });
    if (q.gradeId)   conds.push({ batches:  { some: { batch: { gradeId: q.gradeId } } } });
    if (q.subjectId) conds.push({ subjectId: q.subjectId });
    if (q.dateFrom || q.dateTo) {
      const df: any = {};
      if (q.dateFrom) df.gte = new Date(q.dateFrom);
      if (q.dateTo)   df.lte = new Date(q.dateTo);
      conds.push({ submissionDate: df });
    }

    const assignments = await prisma.assignment.findMany({
      where: { AND: conds }, orderBy: { assignmentDate: "asc" },
      include: {
        subject:     { select: { name: true } },
        batches:     { include: { batch: { select: { name: true } } } },
        submissions: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, rollNumber: true, batch: { select: { name: true } } } },
          },
        },
      },
    });

    const data = assignments.map((a) => ({
      id: a.id, name: a.name, subject: a.subject?.name ?? "—",
      assignDate: a.assignmentDate, dueDate: a.submissionDate,
      batches: a.batches.map((ab) => ab.batch.name).join(", "),
      total:     a.submissions.length,
      submitted: a.submissions.filter((s) => s.status !== "NOT_SUBMITTED").length,
      pending:   a.submissions.filter((s) => s.status === "NOT_SUBMITTED").length,
      students:  a.submissions.map((s) => ({
        name:  `${s.student.firstName} ${s.student.lastName}`,
        roll:  s.student.rollNumber ?? "—",
        batch: s.student.batch?.name ?? "—",
        status: s.status,
        submittedAt: s.submittedAt,
      })).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    if (q.format !== "excel") return reply.send({ success: true, data });

    const wb = new ExcelJS.Workbook(); wb.creator = "CADB";

    // Sheet 1: Assignment Summary
    const ws1 = wb.addWorksheet("Assignment Summary");
    titleRow(ws1, `Assignment Completion Report — ${q.academicYear}`, 7);
    headerRow(ws1.addRow(["Assignment", "Subject", "Batches", "Due Date", "Total", "Submitted", "Pending"]));
    data.forEach((a, i) => {
      dataRow(ws1.addRow([a.name, a.subject, a.batches, fmtDate(a.dueDate as any), a.total, a.submitted, a.pending]), i);
    });
    autoWidths(ws1, [32, 20, 24, 16, 10, 12, 12]);

    // Per-assignment sheets
    for (const a of data) {
      const ws = wb.addWorksheet(a.name.slice(0, 28));
      titleRow(ws, a.name, 4);
      const sumR = ws.addRow([`Subject: ${a.subject}`, `Due: ${fmtDate(a.dueDate as any)}`, `Submitted: ${a.submitted}/${a.total}`, `Pending: ${a.pending}`]);
      sumR.eachCell((c) => { c.font = { bold: true, size: 9, color: { argb: INDIGO } }; }); sumR.height = 16;
      ws.addRow([]);
      headerRow(ws.addRow(["Roll No", "Name", "Batch", "Status", "Submitted At"]));
      a.students.forEach((s, i) => {
        const r = ws.addRow([s.roll, s.name, s.batch, s.status.replace(/_/g, " "), s.submittedAt ? fmtDate(s.submittedAt as any) : "—"]);
        dataRow(r, i);
        if (s.status === "NOT_SUBMITTED") r.getCell(4).font = { size: 9, bold: true, color: { argb: "FFEF4444" } };
      });
      autoWidths(ws, [14, 28, 20, 18, 18]);
    }

    const buf = await wb.xlsx.writeBuffer();
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="assignment_completion_${q.academicYear.replace(/\//g, "-")}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });
};
