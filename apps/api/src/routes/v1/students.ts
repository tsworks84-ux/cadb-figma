import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { hashPassword } from "../../utils/password.js";
import { uploadFile } from "../../utils/s3.js";
import { sendMail } from "../../utils/mailer.js";
import { randomUUID } from "crypto";
import path from "path";
import { getTeacherBatchIds } from "./teacherUtils.js";
import { requireModulePermission } from "../../utils/permissions.js";

const DEFAULT_PASSWORD = "Welcome@123";

function requireAdmin(request: any, reply: any) {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
}

async function generateStudentCode(): Promise<string> {
  const last = await prisma.student.findFirst({
    orderBy: { createdAt: "desc" },
    select: { studentCode: true },
  });
  if (!last) return "STU0001";
  const num = parseInt(last.studentCode.replace(/\D/g, ""), 10);
  return `STU${String((isNaN(num) ? 0 : num) + 1).padStart(4, "0")}`;
}

async function generateAdmissionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ADM-${year}-`;
  const last = await prisma.student.findFirst({
    where: { admissionNumber: { startsWith: prefix } },
    orderBy: { admissionNumber: "desc" },
    select: { admissionNumber: true },
  });
  if (!last?.admissionNumber) return `${prefix}0001`;
  const num = parseInt(last.admissionNumber.replace(prefix, ""), 10);
  return `${prefix}${String((isNaN(num) ? 0 : num) + 1).padStart(4, "0")}`;
}

const createSchema = z.object({
  firstName:        z.string().min(1),
  lastName:         z.string().min(1),
  middleName:       z.string().optional(),
  email:            z.string().email(),
  phone:            z.string().optional(),
  gender:           z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth:      z.string().optional(),
  address:          z.any().optional(),
  nationality:      z.string().optional(),
  rollNumber:       z.string().optional(),
  schoolId:         z.string().optional(),
  parentName:       z.string().optional(),
  parentPhone:      z.string().optional(),
  parentEmail:      z.string().optional(),
  parentRelation:   z.string().optional(),
  parentOccupation: z.string().optional(),
  parentAddress:    z.any().optional(),
  motherName:       z.string().optional(),
  motherPhone:      z.string().optional(),
  motherEmail:      z.string().optional(),
  motherOccupation: z.string().optional(),
  communicationContact:      z.enum(["FATHER","MOTHER","BOTH","OTHER"]).optional(),
  communicationContactName:  z.string().optional(),
  communicationContactPhone: z.string().optional(),
  admissionNumber:  z.string().optional(),
  admissionDate:    z.string().optional(),
  academicYear:     z.string().optional(),
  totalFee:         z.number().optional(),
  paidFee:          z.number().optional(),
  discountType:     z.enum(["PERCENTAGE", "AMOUNT"]).optional(),
  discountAmount:   z.number().optional(),
  paymentDate:      z.string().optional(),
  paymentMode:      z.string().optional(),
  receiptNumber:    z.string().optional(),
  paymentNote:      z.string().optional(),
  gradeId:          z.string().optional(),
  courseId:         z.string().optional(),
  initialPassword:  z.string().min(8).optional(),
  instalments: z.array(z.object({
    instalmentNo: z.number().int().positive(),
    label:        z.string().optional(),
    amount:       z.number().positive(),
    dueDate:      z.string(),
  })).optional(),
});

const updateSchema = createSchema.partial().extend({
  status:     z.enum(["ACTIVE","INACTIVE","SUSPENDED","GRADUATED","DROPPED"]).optional(),
  isArchived: z.boolean().optional(),
});

export async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);
  // Students tab — gated on the STU_PROFILE grant (SUPER_ADMIN / HR_ADMIN bypass).
  fastify.addHook("preHandler", requireModulePermission("STU_PROFILE"));

  // ── LIST ───────────────────────────────────────────────────────────────────

  fastify.get("/", async (request, reply) => {
    const q = request.query as any;
    const {
      search, status, archived, batchId, teacherId, academicYear, schoolId, gradeId,
      sortBy = "createdAt", sortOrder = "desc",
      page = "1", limit = "50",
    } = q;

    const where: any = {};

    if (archived === "true")       where.isArchived = true;
    else if (archived === "false") where.isArchived = false;

    if (status && status !== "ALL") where.status = status;

    if (batchId) {
      where.studentBatches = { some: { batchId } };
    } else if (teacherId) {
      const tBatchIds = await getTeacherBatchIds(teacherId);
      where.studentBatches = { some: { batchId: { in: tBatchIds.length ? tBatchIds : ["__none__"] } } };
    }
    if (academicYear) where.academicYear = academicYear;
    if (schoolId)     where.schoolId     = schoolId;
    if (gradeId)      where.gradeId      = gradeId;

    if (search) {
      where.OR = [
        { firstName:   { contains: search, mode: "insensitive" } },
        { lastName:    { contains: search, mode: "insensitive" } },
        { studentCode: { contains: search, mode: "insensitive" } },
        { email:       { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy =
      sortBy === "name" ? [{ firstName: sortOrder }, { lastName: sortOrder }]
                        : [{ createdAt: sortOrder }];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [students, total, statusCounts, batchCounts] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true, studentCode: true,
          firstName: true, lastName: true, middleName: true,
          email: true, phone: true, photoUrl: true, gender: true,
          parentName: true, parentPhone: true,
          status: true, isArchived: true, mustChangePassword: true,
          academicYear: true, admissionNumber: true, admissionDate: true,
          createdAt: true,
          studentBatches: { select: { batchId: true, joinedAt: true, batch: { select: { id: true, name: true, academicYear: true } } } },
          school:  { select: { id: true, name: true } },
          grade:   { select: { id: true, name: true } },
          address: true,
        },
      }),
      prisma.student.count({ where }),
      prisma.student.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.studentBatch.groupBy({ by: ["batchId"], _count: { _all: true } }),
    ]);

    const stats = {
      total,
      byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all])),
      batchCount: batchCounts.length,
      avgBatchStrength: batchCounts.length > 0
        ? Math.round(batchCounts.reduce((s, r) => s + r._count._all, 0) / batchCounts.length)
        : 0,
    };

    return reply.send({ success: true, data: students, meta: { total, page: parseInt(page), limit: take }, stats });
  });

  // ── GET ONE ────────────────────────────────────────────────────────────────

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true, studentCode: true,
        firstName: true, lastName: true, middleName: true,
        email: true, phone: true, photoUrl: true, gender: true,
        dateOfBirth: true, address: true, rollNumber: true, nationality: true,
        parentName: true, parentPhone: true, parentEmail: true,
        parentRelation: true, parentOccupation: true, parentAddress: true,
        motherName: true, motherPhone: true, motherEmail: true, motherOccupation: true,
        communicationContact: true, communicationContactName: true, communicationContactPhone: true,
        admissionNumber: true, admissionDate: true, academicYear: true,
        totalFee: true, paidFee: true, discountType: true, discountAmount: true,
        paymentDate: true, paymentMode: true, receiptNumber: true, paymentNote: true,
        status: true, isArchived: true, mustChangePassword: true,
        createdAt: true, updatedAt: true,
        studentBatches: {
          select: { id: true, batchId: true, joinedAt: true, batch: { select: { id: true, name: true, academicYear: true, isActive: true, grade: { select: { id: true, name: true } }, location: { select: { id: true, name: true } } } } },
          orderBy: { joinedAt: "asc" },
        },
        batchHistory: {
          orderBy: { removedAt: "desc" },
          select: { id: true, batchName: true, academicYear: true, assignedAt: true, removedAt: true,
                    batch: { select: { id: true, name: true } } },
        },
        grade:   { select: { id: true, name: true } },
        course:  { select: { id: true, name: true, fee: true } },
        school:  { select: { id: true, name: true } },
        instalments: {
          select: { id: true, instalmentNo: true, label: true, amount: true, dueDate: true, isPaid: true, paidAt: true, paidAmount: true, paymentMode: true, note: true },
          orderBy: { instalmentNo: "asc" },
        },
        paymentLogs: {
          select: { id: true, amount: true, paymentMode: true, paymentDate: true, receiptNumber: true, note: true, instalmentId: true, createdAt: true, instalment: { select: { instalmentNo: true, label: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });
    return reply.send({ success: true, data: student });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  fastify.post("/", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { email, dateOfBirth, admissionDate, paymentDate, initialPassword, instalments, batchId, ...rest } = parsed.data as any;

    const emailExists = await prisma.student.findUnique({ where: { email } });
    if (emailExists) return reply.status(400).send({ success: false, error: `Email "${email}" is already registered` });

    // Auto-generate admission number if not supplied
    const admissionNumber = rest.admissionNumber || await generateAdmissionNumber();
    const { admissionNumber: _ignored, ...restWithoutAdm } = rest;

    const studentCode    = await generateStudentCode();
    const chosenPassword = initialPassword ?? DEFAULT_PASSWORD;
    const passwordHash   = await hashPassword(chosenPassword);

    const student = await prisma.student.create({
      data: {
        ...restWithoutAdm,
        email,
        admissionNumber,
        studentCode,
        passwordHash,
        initialPasswordHash: passwordHash,
        mustChangePassword: true,
        dateOfBirth:   dateOfBirth   ? new Date(dateOfBirth)   : undefined,
        admissionDate: admissionDate ? new Date(admissionDate) : undefined,
        paymentDate:   paymentDate   ? new Date(paymentDate)   : undefined,
      },
      select: {
        id: true, studentCode: true, admissionNumber: true,
        firstName: true, lastName: true, email: true,
        phone: true, status: true, createdAt: true,
        studentBatches: { select: { batchId: true, batch: { select: { id: true, name: true, academicYear: true } } } },
        grade:   { select: { id: true, name: true } },
        course:  { select: { id: true, name: true, fee: true } },
      },
    });

    // Link to batch via StudentBatch junction table
    if (batchId) {
      await prisma.studentBatch.create({
        data: { studentId: student.id, batchId, joinedAt: new Date() },
      });
    }

    // Create instalment plan if provided
    if (instalments?.length) {
      await prisma.studentInstalment.createMany({
        data: instalments.map((ins: any) => ({
          studentId:    student.id,
          instalmentNo: ins.instalmentNo,
          label:        ins.label,
          amount:       ins.amount,
          dueDate:      new Date(ins.dueDate),
        })),
      });
    }

    return reply.status(201).send({
      success: true,
      data: student,
      defaultPassword: chosenPassword,
    });
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  fastify.patch("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { dateOfBirth, admissionDate, email, batchId: _batchId, ...rest } = parsed.data as any;

    if (email) {
      const conflict = await prisma.student.findFirst({ where: { email, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Email "${email}" is already in use` });
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...rest,
        ...(email         ? { email }                                 : {}),
        ...(dateOfBirth   ? { dateOfBirth:   new Date(dateOfBirth)   } : {}),
        ...(admissionDate ? { admissionDate: new Date(admissionDate) } : {}),
      },
      select: {
        id: true, studentCode: true, firstName: true, lastName: true, email: true,
        phone: true, status: true, isArchived: true, createdAt: true,
        studentBatches: { select: { batchId: true, batch: { select: { id: true, name: true, academicYear: true } } } },
      },
    });
    return reply.send({ success: true, data: student });
  });

  // ── ARCHIVE TOGGLE ─────────────────────────────────────────────────────────

  fastify.patch("/:id/archive", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const student = await prisma.student.findUnique({ where: { id }, select: { isArchived: true } });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const updated = await prisma.student.update({ where: { id }, data: { isArchived: !student.isArchived } });
    return reply.send({ success: true, data: updated });
  });

  // ── RESET PASSWORD ─────────────────────────────────────────────────────────

  fastify.post("/:id/reset-password", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    await prisma.student.update({
      where: { id },
      data: { passwordHash: await hashPassword(DEFAULT_PASSWORD), mustChangePassword: true },
    });
    return reply.send({ success: true, defaultPassword: DEFAULT_PASSWORD });
  });

  // ── PHOTO UPLOAD ──────────────────────────────────────────────────────────

  fastify.patch("/:id/photo", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const file = await (request as any).file();
    if (!file) return reply.status(400).send({ success: false, error: "No file uploaded" });

    const ext = path.extname(file.filename).slice(1).toLowerCase() || "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return reply.status(400).send({ success: false, error: "Only JPG, PNG or WebP allowed" });
    }

    const fileName = `student_photo_${id}_${randomUUID()}.${ext}`;
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const photoUrl = await uploadFile(buffer, `uploads/${fileName}`, file.mimetype, fileName);
    await prisma.student.update({ where: { id }, data: { photoUrl } });
    return reply.send({ success: true, data: { photoUrl } });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  fastify.delete("/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.student.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── PAYMENT LOGS ───────────────────────────────────────────────────────────

  const paymentLogSchema = z.object({
    amount:        z.number().positive(),
    paymentMode:   z.string().optional(),
    paymentDate:   z.string().optional(),
    receiptNumber: z.string().optional(),
    note:          z.string().optional(),
    instalmentId:  z.string().optional(),
  });

  fastify.get("/:id/payment-logs", async (request, reply) => {
    const { id } = request.params as any;
    const logs = await prisma.studentPaymentLog.findMany({
      where: { studentId: id },
      orderBy: { createdAt: "desc" },
      include: { instalment: { select: { instalmentNo: true, label: true } } },
    });
    return reply.send({ success: true, data: logs });
  });

  fastify.post("/:id/payment-logs", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = paymentLogSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const student = await prisma.student.findUnique({ where: { id }, select: { id: true, paidFee: true } });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const { amount, paymentDate, instalmentId, ...rest } = parsed.data;

    const [log] = await prisma.$transaction(async (tx) => {
      const newLog = await tx.studentPaymentLog.create({
        data: {
          studentId:   id,
          amount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          instalmentId: instalmentId || null,
          ...rest,
        },
        include: { instalment: { select: { instalmentNo: true, label: true } } },
      });
      // Use explicit value to avoid NULL + amount = NULL in Postgres
      await tx.student.update({
        where: { id },
        data: { paidFee: (student.paidFee ?? 0) + amount },
      });
      // If linked to an instalment, mark it paid
      if (instalmentId) {
        await tx.studentInstalment.update({
          where: { id: instalmentId },
          data: { isPaid: true, paidAt: new Date(), paidAmount: amount, paymentMode: rest.paymentMode ?? null, note: rest.note ?? null },
        });
      }
      return [newLog];
    });

    return reply.status(201).send({ success: true, data: log });
  });

  fastify.delete("/:id/payment-logs/:logId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id, logId } = request.params as any;
    const log = await prisma.studentPaymentLog.findUnique({ where: { id: logId, studentId: id } });
    if (!log) return reply.status(404).send({ success: false, error: "Log not found" });

    await prisma.$transaction(async (tx) => {
      const cur = await tx.student.findUnique({ where: { id }, select: { paidFee: true } });
      await tx.studentPaymentLog.delete({ where: { id: logId } });
      await tx.student.update({ where: { id }, data: { paidFee: Math.max(0, (cur?.paidFee ?? 0) - log.amount) } });
      if (log.instalmentId) {
        await tx.studentInstalment.update({
          where: { id: log.instalmentId },
          data: { isPaid: false, paidAt: null, paidAmount: null, paymentMode: null, note: null },
        });
      }
    });

    return reply.send({ success: true });
  });

  // ── ADD INSTALMENT ─────────────────────────────────────────────────────────

  fastify.post("/:id/instalments", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const body = request.body as any;

    const existing = await prisma.studentInstalment.findMany({
      where: { studentId: id }, select: { instalmentNo: true }, orderBy: { instalmentNo: "desc" }, take: 1,
    });
    const nextNo = (existing[0]?.instalmentNo ?? 0) + 1;

    const ins = await prisma.studentInstalment.create({
      data: {
        studentId:    id,
        instalmentNo: nextNo,
        label:        body.label ?? `Instalment ${nextNo}`,
        amount:       parseFloat(body.amount) || 0,
        dueDate:      body.dueDate ? new Date(body.dueDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: ins });
  });

  // ── STUDENT ASSIGNMENTS ────────────────────────────────────────────────────

  fastify.get("/:id/assignments", async (request, reply) => {
    const { id } = request.params as any;
    const { dateFrom, dateTo, subjectId } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);
    if (batchIds.length === 0) {
      return reply.send({
        success: true, data: [],
        stats: { total: 0, approved: 0, submitted: 0, inProcess: 0, rejected: 0, notSubmitted: 0, overdue: 0, completionRate: 0 },
      });
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
          where: { studentId: id },
          select: { status: true, submittedAt: true, reviewNote: true },
        },
      },
    });

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const data = assignments.map((a) => {
      const sub = a.submissions[0];
      const dueDate = new Date(a.submissionDate);
      dueDate.setHours(0, 0, 0, 0);
      const isOverdue = dueDate < todayMidnight;

      let displayStatus: string;
      if (a.status === "ARCHIVED") {
        displayStatus = "ARCHIVED";
      } else if (sub && sub.status !== "NOT_SUBMITTED") {
        displayStatus = sub.status;
      } else {
        displayStatus = isOverdue ? "OVERDUE" : "NOT_SUBMITTED";
      }

      return {
        id: a.id, name: a.name, assignmentDate: a.assignmentDate, submissionDate: a.submissionDate,
        topics: a.topics, note: a.note, attachmentUrl: a.attachmentUrl, attachmentName: a.attachmentName,
        status: a.status, academicYear: a.academicYear, subject: a.subject, faculty: a.employee,
        submission: sub ? { status: sub.status, submittedAt: sub.submittedAt, reviewNote: sub.reviewNote } : null,
        displayStatus,
      };
    });

    const active       = data.filter((d) => d.status !== "ARCHIVED");
    const total        = active.length;
    const approved     = active.filter((d) => d.displayStatus === "APPROVED").length;
    const submitted    = active.filter((d) => d.displayStatus === "SUBMITTED").length;
    const inProcess    = active.filter((d) => d.displayStatus === "IN_PROCESS").length;
    const rejected     = active.filter((d) => d.displayStatus === "REJECTED").length;
    const notSubmitted = active.filter((d) => d.displayStatus === "NOT_SUBMITTED").length;
    const overdue      = active.filter((d) => d.displayStatus === "OVERDUE").length;
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return reply.send({
      success: true, data,
      stats: { total, approved, submitted, inProcess, rejected, notSubmitted, overdue, completionRate },
    });
  });

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────

  fastify.get("/:id/attendance", async (request, reply) => {
    const { id } = request.params as any;
    const { dateFrom, dateTo, subjectId } = request.query as any;

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);
    if (batchIds.length === 0) {
      return reply.send({
        success: true, data: [],
        stats: { total: 0, present: 0, absent: 0, unrecorded: 0, percentage: 0, bySubject: [] },
      });
    }

    const where: any = {
      batches: { some: { batchId: { in: batchIds } } },
      status: { not: "CANCELLED" },
    };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo)   where.date.lte = new Date(dateTo);
    }
    if (subjectId) where.subjectId = subjectId;

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true, date: true, startTime: true, endTime: true, topics: true, status: true,
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        attendances: {
          where: { studentId: id },
          select: { isPresent: true, note: true },
        },
      },
    });

    const data = schedules.map((s) => {
      const att = s.attendances[0];
      return {
        id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime,
        topics: s.topics, status: s.status, subject: s.subject, faculty: s.employee,
        attendanceStatus: att ? (att.isPresent ? "PRESENT" : "ABSENT") : "UNRECORDED",
        note: att?.note ?? null,
      };
    });

    const total      = data.length;
    const present    = data.filter((d) => d.attendanceStatus === "PRESENT").length;
    const absent     = data.filter((d) => d.attendanceStatus === "ABSENT").length;
    const unrecorded = data.filter((d) => d.attendanceStatus === "UNRECORDED").length;
    const recorded   = present + absent;
    const percentage = recorded > 0 ? Math.round((present / recorded) * 100) : 0;

    const subjectMap = new Map<string, { id: string; name: string; code: string; total: number; present: number; absent: number }>();
    for (const d of data) {
      if (!d.subject) continue;
      const key = d.subject.id;
      if (!subjectMap.has(key)) subjectMap.set(key, { ...d.subject, total: 0, present: 0, absent: 0 });
      const entry = subjectMap.get(key)!;
      entry.total++;
      if (d.attendanceStatus === "PRESENT") entry.present++;
      else if (d.attendanceStatus === "ABSENT") entry.absent++;
    }
    const bySubject = Array.from(subjectMap.values()).map((s) => ({
      ...s,
      percentage: s.present + s.absent > 0 ? Math.round((s.present / (s.present + s.absent)) * 100) : 0,
    }));

    return reply.send({ success: true, data, stats: { total, present, absent, unrecorded, percentage, bySubject } });
  });

  // ── STUDENT ASSESSMENTS (exam results with rank + percentile) ──────────────

  fastify.get("/:id/assessments", async (request, reply) => {
    const { id } = request.params as any;
    const { academicYear, dateFrom, dateTo } = request.query as any;

    // 1. Verify student exists and get their batch memberships
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, studentBatches: { select: { batchId: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const batchIds = student.studentBatches.map((sb) => sb.batchId);

    // 2. Build exam filter: exams for the student's batches (batch-based, same as assignments)
    //    Also include exams where student has a direct result (e.g. added to exam from another batch)
    const examWhere: any = {
      OR: [
        ...(batchIds.length > 0 ? [{ batches: { some: { batchId: { in: batchIds } } } }] : []),
        { results: { some: { studentId: id } } },
      ],
      status:  { not: "ARCHIVED" },
    };
    if (academicYear) examWhere.academicYear = academicYear;
    if (dateFrom || dateTo) {
      examWhere.examDate = {};
      if (dateFrom) examWhere.examDate.gte = new Date(dateFrom);
      if (dateTo)   examWhere.examDate.lte = new Date(dateTo);
    }

    // 3. Fetch exams with ALL non-excluded results (to compute rank/avg/max)
    //    Also fetch this student's result separately (regardless of isExcluded) so we always show their marks
    const exams = await prisma.exam.findMany({
      where: examWhere,
      orderBy: { examDate: "desc" },
      include: {
        subjects: {
          include: { subject: { select: { id: true, name: true } } },
          orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }],
        },
        batches: {
          include: { batch: { select: { id: true, name: true } } },
        },
        // All non-excluded results for class stats
        results: {
          where:   { isExcluded: false },
          include: { marks: true },
        },
      },
    });

    // Fetch this student's own results separately (all exams, regardless of exclusion)
    const myResultsRaw = await prisma.examResult.findMany({
      where: { examId: { in: exams.map((e) => e.id) }, studentId: id },
      include: { marks: true },
    });
    const myResultMap = new Map(myResultsRaw.map((r) => [r.examId, r]));

    // 4. For each exam compute per-student totals then rank/percentile
    const rows = exams.map((exam) => {
      // Sum marks for every non-excluded result (for class stats)
      const totalsMap = new Map<string, number>();
      for (const r of exam.results) {
        const total = r.marks.reduce((s, m) => s + (m.marks ?? 0), 0);
        totalsMap.set(r.studentId, total);
      }

      const allTotals = [...totalsMap.values()].filter((t) => t > 0).sort((a, b) => b - a);
      // Use the separately-fetched result for this student (not filtered by isExcluded)
      const myResult  = myResultMap.get(exam.id) ?? null;
      const myTotal   = myResult
        ? myResult.marks.reduce((s, m) => s + (m.marks ?? 0), 0)
        : null;

      // Rank: 1-based position (students with same score share rank)
      let rank: number | null = null;
      let percentile: number | null = null;
      if (myTotal !== null && allTotals.length > 0) {
        // Rank: 1-based; first index where another score ≤ mine
        rank = allTotals.findIndex((t) => t <= myTotal) + 1;

        // JEE Main NTA percentile formula:
        //   Percentile = (# students who scored ≤ my score / total students) × 100
        // This gives topper 100.00, not "strictly below" which would give topper 80th if 5 students.
        const atOrBelow = allTotals.filter((t) => t <= myTotal).length;
        percentile = Math.round((atOrBelow / allTotals.length) * 100 * 100) / 100; // 2 d.p.
      }

      const classMax = allTotals[0] ?? null;
      const classAvg = allTotals.length > 0
        ? Math.round((allTotals.reduce((s, t) => s + t, 0) / allTotals.length) * 10) / 10
        : null;

      // Subject-wise marks for THIS student (from separately-fetched result)
      const myMarks = myResult?.marks.map((m) => {
        const subjectEntry = exam.subjects.find(
          (es) => es.paperNum === m.paperNum && es.subjectSlot === m.subjectSlot,
        );
        return {
          paperNum:    m.paperNum,
          subjectSlot: m.subjectSlot,
          marks:       m.marks,
          maxMarks:    subjectEntry?.maxMarks ?? null,
          subjectName: subjectEntry?.subject?.name ?? null,
        };
      }) ?? [];

      return {
        exam: {
          id:          exam.id,
          name:        exam.name,
          examDate:    exam.examDate,
          startTime:   exam.startTime,
          endTime:     exam.endTime,
          totalMarks:  exam.totalMarks,
          numPapers:   exam.numPapers,
          numSubjects: exam.numSubjects,
          status:      exam.status,
          academicYear: exam.academicYear,
          batches:     exam.batches.map((eb) => eb.batch.name),
          subjects:    exam.subjects,
        },
        result: myResult ? {
          id:         myResult.id,
          attended:   myResult.attended,
          isExcluded: myResult.isExcluded,
          total:      myTotal,
          marks:      myMarks,
        } : null,
        // marksRecorded: false means the exam exists for this student's batch but no ExamResult yet
        marksRecorded: myResult !== null,
        stats: {
          rank,
          percentile,
          classMax,
          classAvg,
          totalStudents: allTotals.length,
        },
      };
    });

    return reply.send({ success: true, data: rows });
  });

  // ── INSTALMENT PAY ─────────────────────────────────────────────────────────

  fastify.patch("/:id/instalments/:instalmentId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id, instalmentId } = request.params as any;
    const body = request.body as any;
    const ins = await prisma.studentInstalment.findUnique({ where: { id: instalmentId, studentId: id } });
    if (!ins) return reply.status(404).send({ success: false, error: "Instalment not found" });

    const data: any = {};
    // Amount / due-date edits (independent of paid status)
    if (body.amount  !== undefined) data.amount  = parseFloat(body.amount);
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.label   !== undefined) data.label   = body.label;

    // Paid-status toggle (only when explicitly sent)
    if (body.isPaid !== undefined) {
      const markPaid = body.isPaid !== false;
      data.isPaid      = markPaid;
      data.paidAt      = markPaid ? new Date() : null;
      data.paidAmount  = body.paidAmount ?? null;
      data.paymentMode = body.paymentMode ?? null;
      data.note        = body.note ?? null;
    }

    await prisma.studentInstalment.update({ where: { id: instalmentId }, data });

    return reply.send({ success: true });
  });

  // ── PTM routes ─────────────────────────────────────────────────────────────

  const ptmInclude = {
    attendees: {
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true } } },
    },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    actionItems: { orderBy: { createdAt: "asc" as const } },
  } as const;

  // GET /students/:id/ptms
  fastify.get("/:id/ptms", async (request, reply) => {
    const { id } = request.params as any;
    const ptms = await prisma.pTM.findMany({
      where: { studentId: id },
      include: ptmInclude,
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    });
    return reply.send({ success: true, data: ptms });
  });

  // POST /students/:id/ptms — schedule a new PTM and send emails
  fastify.post("/:id/ptms", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const body = request.body as any;

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, parentEmail: true, motherEmail: true,
        communicationContact: true,
      },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    const { date, startTime, endTime, venue, agenda, attendeeIds = [] } = body;
    if (!date || !startTime) return reply.status(400).send({ success: false, error: "date and startTime are required" });

    const ptm = await prisma.pTM.create({
      data: {
        studentId:  id,
        date:       new Date(date),
        startTime,
        endTime:    endTime  || null,
        venue:      venue    || null,
        agenda:     agenda   || null,
        createdById: (request as any).user?.id ?? null,
        attendees: {
          create: (attendeeIds as string[]).map((empId) => ({ employeeId: empId })),
        },
      },
      include: ptmInclude,
    });

    // ── Collect email addresses ──────────────────────────────────────────────
    const recipientSet = new Set<string>();

    // Teachers/attendees
    for (const a of ptm.attendees) {
      if (a.employee.email) recipientSet.add(a.employee.email);
    }

    // Parents — send based on communicationContact preference
    const cc = student.communicationContact ?? "BOTH";
    if ((cc === "FATHER" || cc === "BOTH" || cc === "OTHER") && student.parentEmail)
      recipientSet.add(student.parentEmail);
    if ((cc === "MOTHER" || cc === "BOTH") && student.motherEmail)
      recipientSet.add(student.motherEmail);
    // Always CC student email itself (as fallback if no parent email)
    if (recipientSet.size === 0 && student.email)
      recipientSet.add(student.email);

    // ── Send email ────────────────────────────────────────────────────────────
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const dateStr = new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeStr = endTime ? `${startTime} – ${endTime}` : startTime;
    const attendeeNames = ptm.attendees.map((a) => `${a.employee.firstName} ${a.employee.lastName}`).join(", ");
    const studentName   = `${student.firstName} ${student.lastName}`;

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
        <div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
          <h1 style="color:white;margin:0;font-size:22px">📅 PTM Scheduled</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px">Parent–Teacher Meeting</p>
        </div>

        <p style="margin:0 0 16px">Dear Parent / Faculty,</p>
        <p style="margin:0 0 20px">
          A Parent–Teacher Meeting has been scheduled for
          <strong>${studentName}</strong>. Please find the details below.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px">📅 Date</td>
                <td style="padding:6px 0;font-weight:600">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">⏰ Time</td>
                <td style="padding:6px 0;font-weight:600">${timeStr}</td></tr>
            ${venue ? `<tr><td style="padding:6px 0;color:#6b7280">📍 Venue</td>
                <td style="padding:6px 0;font-weight:600">${venue}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#6b7280">👤 Student</td>
                <td style="padding:6px 0;font-weight:600">${studentName}</td></tr>
            ${attendeeNames ? `<tr><td style="padding:6px 0;color:#6b7280">👩‍🏫 Teachers</td>
                <td style="padding:6px 0;font-weight:600">${attendeeNames}</td></tr>` : ""}
            ${agenda ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">📝 Agenda</td>
                <td style="padding:6px 0">${agenda}</td></tr>` : ""}
          </table>
        </div>

        <p style="font-size:13px;color:#6b7280">
          Please contact the school office if you have any questions or need to reschedule.
        </p>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">
          This is an automated notification from Centum Academy. Please do not reply to this email.
        </p>
      </div>
    `;

    // Fire-and-forget; don't block the response on email delivery
    const toList = [...recipientSet];
    if (toList.length > 0) {
      sendMail({
        to:      toList[0],
        cc:      toList.slice(1).join(",") || undefined,
        subject: `PTM Scheduled — ${studentName} · ${dateStr}`,
        html,
      }).catch((err) => console.error("[PTM email]", err));
    }

    return reply.status(201).send({ success: true, data: ptm });
  });

  // PATCH /students/:id/ptms/:ptmId — update status or notes
  fastify.patch("/:id/ptms/:ptmId", async (request, reply) => {
    requireAdmin(request, reply);
    const { ptmId } = request.params as any;
    const { status, notes, venue, agenda, startTime, endTime } = request.body as any;
    const data: any = {};
    if (status    !== undefined) data.status    = status;
    if (notes     !== undefined) data.notes     = notes;
    if (venue     !== undefined) data.venue     = venue;
    if (agenda    !== undefined) data.agenda    = agenda;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime   !== undefined) data.endTime   = endTime;
    const ptm = await prisma.pTM.update({ where: { id: ptmId }, data, include: ptmInclude });
    return reply.send({ success: true, data: ptm });
  });

  // DELETE /students/:id/ptms/:ptmId
  fastify.delete("/:id/ptms/:ptmId", async (request, reply) => {
    requireAdmin(request, reply);
    const { ptmId } = request.params as any;
    await prisma.pTM.delete({ where: { id: ptmId } });
    return reply.send({ success: true });
  });

  // ── PTM Action Items ────────────────────────────────────────────────────────

  const ptmIncludeWithItems = {
    ...ptmInclude,
    actionItems: { orderBy: { createdAt: "asc" as const } },
  } as const;

  // GET /students/:id/ptms/:ptmId/action-items
  fastify.get("/:id/ptms/:ptmId/action-items", async (request, reply) => {
    const { ptmId } = request.params as any;
    const items = await prisma.pTMActionItem.findMany({
      where: { ptmId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data: items });
  });

  // POST /students/:id/ptms/:ptmId/action-items
  fastify.post("/:id/ptms/:ptmId/action-items", async (request, reply) => {
    requireAdmin(request, reply);
    const { ptmId } = request.params as any;
    const { description, status } = request.body as any;
    if (!description?.trim()) return reply.status(400).send({ success: false, error: "description is required" });
    const item = await prisma.pTMActionItem.create({
      data: {
        ptmId,
        description: description.trim(),
        status: status ?? "YET_TO_START",
      },
    });
    return reply.status(201).send({ success: true, data: item });
  });

  // PATCH /students/:id/ptms/:ptmId/action-items/:itemId
  fastify.patch("/:id/ptms/:ptmId/action-items/:itemId", async (request, reply) => {
    requireAdmin(request, reply);
    const { itemId } = request.params as any;
    const { description, status } = request.body as any;
    const data: any = {};
    if (description !== undefined) data.description = description.trim();
    if (status      !== undefined) data.status      = status;
    const item = await prisma.pTMActionItem.update({ where: { id: itemId }, data });
    return reply.send({ success: true, data: item });
  });

  // DELETE /students/:id/ptms/:ptmId/action-items/:itemId
  fastify.delete("/:id/ptms/:ptmId/action-items/:itemId", async (request, reply) => {
    requireAdmin(request, reply);
    const { itemId } = request.params as any;
    await prisma.pTMActionItem.delete({ where: { id: itemId } });
    return reply.send({ success: true });
  });
}
