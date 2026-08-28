import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import type { StudentJwtPayload } from "@cadb/types";
import { uploadFile } from "../../utils/s3.js";
import { randomUUID } from "crypto";
import path from "path";
import { fullName } from "../../utils/name.js";

async function authenticateStudent(fastify: FastifyInstance, request: any, reply: any) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ success: false, error: "Unauthorized" });
  try {
    const payload = fastify.jwt.verify<StudentJwtPayload>(auth.slice(7));
    if (payload.userType !== "STUDENT") throw new Error("Not a student token");
    (request as any).student = payload;
  } catch {
    return reply.status(401).send({ success: false, error: "Invalid or expired token" });
  }
}

export async function studentPortalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", (req, rep) => authenticateStudent(fastify, req, rep));

  // ── ACADEMIC YEARS (reference data for filters) ───────────────────────────
  fastify.get("/academic-years", async (_request, reply) => {
    const years = await prisma.academicYear.findMany({
      where: { isArchived: false },
      orderBy: { name: "desc" },
      select: { id: true, name: true, isActive: true },
    });
    return reply.send({ success: true, data: years });
  });

  // ── PROFILE ────────────────────────────────────────────────────────────────
  fastify.get("/profile", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true, studentCode: true,
        firstName: true, lastName: true, middleName: true,
        email: true, phone: true, photoUrl: true, gender: true,
        dateOfBirth: true, address: true, rollNumber: true, nationality: true,
        parentName: true, parentPhone: true, parentEmail: true,
        parentRelation: true, parentOccupation: true,
        motherName: true, motherPhone: true, motherEmail: true, motherOccupation: true,
        communicationContact: true, communicationContactName: true, communicationContactPhone: true,
        admissionNumber: true, admissionDate: true, academicYear: true,
        totalFee: true, paidFee: true, discountType: true, discountAmount: true,
        status: true, mustChangePassword: true,
        studentBatches: {
          select: {
            id: true, batchId: true, joinedAt: true,
            batch: {
              select: {
                id: true, name: true, academicYear: true, isActive: true,
                grade: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        grade:  { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
        instalments: {
          select: { id: true, instalmentNo: true, label: true, amount: true, dueDate: true, isPaid: true, paidAt: true, paidAmount: true, paymentMode: true },
          orderBy: { instalmentNo: "asc" },
        },
        paymentLogs: {
          select: { id: true, amount: true, paymentMode: true, paymentDate: true, receiptNumber: true, note: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: student });
  });

  // ── PHOTO UPLOAD ───────────────────────────────────────────────────────────
  fastify.patch("/photo", async (request, reply) => {
    const studentId = (request as any).student.sub as string;

    const file = await (request as any).file();
    if (!file) return reply.status(400).send({ success: false, error: "No file uploaded" });

    const ext = path.extname(file.filename).slice(1).toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return reply.status(400).send({ success: false, error: "Only JPG, PNG or WebP allowed" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.status(400).send({ success: false, error: "File too large (max 5 MB)" });
    }

    const fileName = `student_photo_${studentId}_${randomUUID()}.${ext}`;
    const photoUrl = await uploadFile(buffer, `uploads/${fileName}`, file.mimetype, fileName);

    await prisma.student.update({ where: { id: studentId }, data: { photoUrl } });
    return reply.send({ success: true, data: { photoUrl } });
  });

  // ── ASSIGNMENTS ────────────────────────────────────────────────────────────
  fastify.get("/assignments", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { dateFrom, dateTo, subjectId } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);
    if (batchIds.length === 0) {
      return reply.send({ success: true, data: [], stats: { total: 0, approved: 0, submitted: 0, inProcess: 0, rejected: 0, notSubmitted: 0, overdue: 0, completionRate: 0 } });
    }

    const where: any = { batches: { some: { batchId: { in: batchIds } } } };
    if (dateFrom || dateTo) {
      where.submissionDate = {};
      if (dateFrom) where.submissionDate.gte = new Date(dateFrom);
      if (dateTo)   where.submissionDate.lte = new Date(dateTo);
    }
    if (subjectId) where.subjectId = subjectId;

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { submissionDate: "asc" },
      select: {
        id: true, name: true, assignmentDate: true, submissionDate: true,
        topics: true, note: true, attachmentUrl: true, attachmentName: true,
        status: true, academicYear: true,
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        submissions: {
          where: { studentId },
          select: { status: true, submittedAt: true, reviewNote: true },
        },
      },
    });

    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const data = assignments.map((a) => {
      const sub = a.submissions[0];
      const dueDate = new Date(a.submissionDate); dueDate.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < todayMidnight;
      let displayStatus: string;
      if (a.status === "ARCHIVED") displayStatus = "ARCHIVED";
      else if (sub && sub.status !== "NOT_SUBMITTED") displayStatus = sub.status;
      else displayStatus = isOverdue ? "OVERDUE" : "NOT_SUBMITTED";
      return {
        id: a.id, name: a.name, assignmentDate: a.assignmentDate, submissionDate: a.submissionDate,
        topics: a.topics, note: a.note, attachmentUrl: a.attachmentUrl, attachmentName: a.attachmentName,
        status: a.status, academicYear: a.academicYear, subject: a.subject, faculty: a.employee,
        submission: sub ? { status: sub.status, submittedAt: sub.submittedAt, reviewNote: sub.reviewNote } : null,
        displayStatus,
      };
    });

    const active = data.filter((d) => d.status !== "ARCHIVED");
    const total = active.length;
    const approved     = active.filter((d) => d.displayStatus === "APPROVED").length;
    const submitted    = active.filter((d) => d.displayStatus === "SUBMITTED").length;
    const inProcess    = active.filter((d) => d.displayStatus === "IN_PROCESS").length;
    const rejected     = active.filter((d) => d.displayStatus === "REJECTED").length;
    const notSubmitted = active.filter((d) => d.displayStatus === "NOT_SUBMITTED").length;
    const overdue      = active.filter((d) => d.displayStatus === "OVERDUE").length;
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return reply.send({ success: true, data, stats: { total, approved, submitted, inProcess, rejected, notSubmitted, overdue, completionRate } });
  });

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────
  fastify.get("/attendance", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { dateFrom, dateTo, subjectId } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);
    if (batchIds.length === 0) {
      return reply.send({ success: true, data: [], stats: { total: 0, present: 0, absent: 0, unrecorded: 0, percentage: 0, bySubject: [] } });
    }

    const scheduleWhere: any = {
      status: { in: ["CONCLUDED", "COMPLETED"] },
      batches: { some: { batchId: { in: batchIds } } },
    };
    if (dateFrom || dateTo) {
      scheduleWhere.date = {};
      if (dateFrom) scheduleWhere.date.gte = new Date(dateFrom);
      if (dateTo)   scheduleWhere.date.lte = new Date(dateTo);
    }
    if (subjectId) scheduleWhere.subjectId = subjectId;

    const schedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true, date: true, startTime: true, endTime: true, topics: true, academicYear: true,
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        attendances: { where: { studentId }, select: { isPresent: true } },
      },
    });

    const data = schedules.map((s) => {
      const att = s.attendances[0];
      const attendanceStatus = att == null ? "UNRECORDED" : att.isPresent ? "PRESENT" : "ABSENT";
      return { id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, topics: s.topics, academicYear: s.academicYear, subject: s.subject, faculty: s.employee, attendanceStatus };
    });

    const total       = data.length;
    const present     = data.filter((d) => d.attendanceStatus === "PRESENT").length;
    const absent      = data.filter((d) => d.attendanceStatus === "ABSENT").length;
    const unrecorded  = data.filter((d) => d.attendanceStatus === "UNRECORDED").length;
    const denominator = present + absent;
    const percentage  = denominator > 0 ? Math.round((present / denominator) * 100) : 0;

    // Per-subject stats
    const subjMap = new Map<string, { id: string; name: string; code: string; total: number; present: number; absent: number }>();
    for (const d of data) {
      if (!d.subject) continue;
      const key = d.subject.id;
      if (!subjMap.has(key)) subjMap.set(key, { ...d.subject, total: 0, present: 0, absent: 0 });
      const e = subjMap.get(key)!;
      e.total++;
      if (d.attendanceStatus === "PRESENT") e.present++;
      else if (d.attendanceStatus === "ABSENT") e.absent++;
    }
    const bySubject = Array.from(subjMap.values()).map((s) => ({
      ...s,
      percentage: s.present + s.absent > 0 ? Math.round((s.present / (s.present + s.absent)) * 100) : 0,
    }));

    return reply.send({ success: true, data, stats: { total, present, absent, unrecorded, percentage, bySubject } });
  });

  // ── ASSESSMENTS ───────────────────────────────────────────────────────────
  fastify.get("/assessments", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { academicYear } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);

    // Find exams for this student's batches OR where student has a direct result
    const examWhere: any = {
      OR: [
        ...(batchIds.length > 0 ? [{ batches: { some: { batchId: { in: batchIds } } } }] : []),
        { results: { some: { studentId } } },
      ],
      status: { not: "ARCHIVED" },
    };
    if (academicYear) examWhere.academicYear = academicYear;

    const exams = await prisma.exam.findMany({
      where: examWhere,
      orderBy: { examDate: "desc" },
      include: {
        subjects: {
          include: { subject: { select: { id: true, name: true } } },
          orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }],
        },
        batches: { include: { batch: { select: { id: true, name: true } } } },
        results: { where: { isExcluded: false }, include: { marks: true } },
      },
    });

    // Fetch this student's own results separately
    const myResultsRaw = await prisma.examResult.findMany({
      where: { examId: { in: exams.map((e) => e.id) }, studentId },
      include: { marks: true },
    });
    const myResultMap = new Map(myResultsRaw.map((r) => [r.examId, r]));

    const rows = exams.map((exam) => {
      const totalsMap = new Map<string, number>();
      for (const r of exam.results) {
        const total = r.marks.reduce((s: number, m: any) => s + (m.marks ?? 0), 0);
        totalsMap.set(r.studentId, total);
      }
      const allTotals = [...totalsMap.values()].filter((t) => t > 0).sort((a, b) => b - a);
      const myResult  = myResultMap.get(exam.id) ?? null;
      const myTotal   = myResult ? myResult.marks.reduce((s: number, m: any) => s + (m.marks ?? 0), 0) : null;

      let rank: number | null = null;
      let percentile: number | null = null;
      if (myTotal !== null && allTotals.length > 0) {
        rank = allTotals.findIndex((t) => t <= myTotal) + 1;
        const atOrBelow = allTotals.filter((t) => t <= myTotal).length;
        percentile = Math.round((atOrBelow / allTotals.length) * 100 * 100) / 100;
      }

      const classMax = allTotals[0] ?? null;
      const classAvg = allTotals.length > 0
        ? Math.round((allTotals.reduce((s: number, t: number) => s + t, 0) / allTotals.length) * 10) / 10
        : null;

      const myMarks = myResult?.marks.map((m: any) => {
        const subjectEntry = exam.subjects.find((es) => es.paperNum === m.paperNum && es.subjectSlot === m.subjectSlot);
        return { paperNum: m.paperNum, subjectSlot: m.subjectSlot, marks: m.marks, maxMarks: subjectEntry?.maxMarks ?? null, subjectName: subjectEntry?.subject?.name ?? null };
      }) ?? [];

      return {
        exam: {
          id: exam.id, name: exam.name, examDate: exam.examDate,
          startTime: exam.startTime, endTime: exam.endTime,
          totalMarks: exam.totalMarks, numPapers: exam.numPapers, numSubjects: exam.numSubjects,
          status: exam.status, academicYear: exam.academicYear,
          batches: exam.batches.map((eb) => eb.batch.name),
          subjects: exam.subjects,
        },
        result: myResult ? { id: myResult.id, attended: myResult.attended, isExcluded: myResult.isExcluded, total: myTotal, marks: myMarks } : null,
        marksRecorded: myResult !== null,
        stats: { rank, percentile, classMax, classAvg, totalStudents: allTotals.length },
      };
    });

    return reply.send({ success: true, data: rows });
  });

  // ── SCHEDULE ───────────────────────────────────────────────────────────────
  fastify.get("/schedule", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { dateFrom, dateTo } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);
    if (batchIds.length === 0) return reply.send({ success: true, data: [] });

    const where: any = {
      batches: { some: { batchId: { in: batchIds } } },
    };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo)   where.date.lte = new Date(dateTo);
    } else {
      // Default: next 30 days from today
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const end   = new Date(today); end.setDate(end.getDate() + 30);
      where.date = { gte: today, lte: end };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true, date: true, startTime: true, endTime: true,
        topics: true, notes: true, status: true, mode: true, academicYear: true,
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
        batches:  { include: { batch: { select: { id: true, name: true } } } },
        attendances: { where: { studentId }, select: { isPresent: true } },
      },
    });

    const data = schedules.map((s) => {
      const att = s.attendances[0];
      const attendanceStatus = s.status !== "CONCLUDED" ? null : (att == null ? "UNRECORDED" : att.isPresent ? "PRESENT" : "ABSENT");
      return {
        id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime,
        topics: s.topics, notes: s.notes, status: s.status, mode: s.mode, academicYear: s.academicYear,
        subject: s.subject, faculty: s.employee, location: s.location,
        batches: s.batches.map((b) => b.batch),
        attendanceStatus,
      };
    });

    return reply.send({ success: true, data });
  });

  // ── FEEDBACK ───────────────────────────────────────────────────────────────

  const MSG_SELECT = {
    id: true, senderType: true, senderName: true,
    message: true, attachmentUrl: true, attachmentName: true, createdAt: true,
  } as const;

  // Count of feedback threads where admin has replied (sidebar badge)
  fastify.get("/feedback/summary", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const responded = await prisma.studentFeedback.count({
      where: { studentId, retractedAt: null, status: "RESPONDED" },
    });
    return reply.send({ success: true, data: { responded } });
  });

  // List own feedback (excluding retracted) — with thread messages
  fastify.get("/feedback", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const rows = await prisma.studentFeedback.findMany({
      where: { studentId, retractedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, type: true, message: true, status: true,
        createdAt: true, updatedAt: true,
        messages: { select: MSG_SELECT, orderBy: { createdAt: "asc" } },
      },
    });
    return reply.send({ success: true, data: rows });
  });

  // Submit new feedback
  fastify.post("/feedback", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { type, message } = request.body as { type: string; message: string };
    if (!["SUGGESTION", "CONCERN"].includes(type))
      return reply.status(400).send({ success: false, error: "Invalid feedback type" });
    if (!message?.trim())
      return reply.status(400).send({ success: false, error: "Message is required" });
    if (message.trim().length > 1000)
      return reply.status(400).send({ success: false, error: "Message must be under 1000 characters" });

    const feedback = await prisma.studentFeedback.create({
      data: { studentId, type: type as any, message: message.trim() },
      select: { id: true, type: true, message: true, status: true, createdAt: true },
    });
    return reply.status(201).send({ success: true, data: feedback });
  });

  // Retract (soft-delete) own feedback — only if OPEN or RESPONDED
  fastify.delete("/feedback/:id", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { id } = request.params as { id: string };
    const existing = await prisma.studentFeedback.findFirst({
      where: { id, studentId, retractedAt: null },
    });
    if (!existing) return reply.status(404).send({ success: false, error: "Feedback not found" });
    if (existing.status === "CLOSED" || existing.status === "CLOSED_BY_STUDENT")
      return reply.status(400).send({ success: false, error: "Closed feedback cannot be retracted" });
    await prisma.studentFeedback.update({
      where: { id },
      data: { retractedAt: new Date() },
    });
    return reply.send({ success: true });
  });

  // Student reply — also reopens feedback if it was closed by admin
  fastify.post("/feedback/:id/reply", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { id } = request.params as { id: string };
    const { message } = request.body as { message: string };

    if (!message?.trim())
      return reply.status(400).send({ success: false, error: "Message is required" });
    if (message.trim().length > 1000)
      return reply.status(400).send({ success: false, error: "Message must be under 1000 characters" });

    const fb = await prisma.studentFeedback.findFirst({ where: { id, studentId, retractedAt: null } });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });
    if (fb.status === "CLOSED")
      return reply.status(400).send({ success: false, error: "This thread has been closed by admin" });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, middleName: true, lastName: true },
    });
    const senderName = student ? fullName(student) : "Student";

    // Reopen if student-closed; OPEN/RESPONDED stay as OPEN after student reply
    const newStatus = fb.status === "CLOSED_BY_STUDENT" ? "OPEN" : fb.status;

    const [msg] = await prisma.$transaction([
      prisma.feedbackMessage.create({
        data: { feedbackId: id, senderType: "STUDENT", senderId: studentId, senderName, message: message.trim() },
        select: { id: true, senderType: true, senderName: true, message: true, createdAt: true },
      }),
      prisma.studentFeedback.update({
        where: { id },
        data: { status: newStatus as any, updatedAt: new Date() },
      }),
    ]);

    return reply.status(201).send({ success: true, data: msg });
  });

  // Student closes feedback
  fastify.patch("/feedback/:id/close", async (request, reply) => {
    const studentId = (request as any).student.sub as string;
    const { id } = request.params as { id: string };
    const fb = await prisma.studentFeedback.findFirst({ where: { id, studentId, retractedAt: null } });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });
    if (fb.status === "CLOSED" || fb.status === "CLOSED_BY_STUDENT")
      return reply.status(400).send({ success: false, error: "Already closed" });
    await prisma.studentFeedback.update({ where: { id }, data: { status: "CLOSED_BY_STUDENT" } });
    return reply.send({ success: true });
  });
}
