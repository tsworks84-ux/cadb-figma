import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import type { StudentJwtPayload } from "@cadb/types";
import { uploadFile } from "../../utils/s3.js";
import { randomUUID } from "crypto";
import path from "path";

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
}
