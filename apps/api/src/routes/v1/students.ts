import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { hashPassword } from "../../utils/password.js";
import { uploadFile } from "../../utils/s3.js";
import { randomUUID } from "crypto";
import path from "path";

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
  batchId:          z.string().optional(),
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

  // ── LIST ───────────────────────────────────────────────────────────────────

  fastify.get("/", async (request, reply) => {
    const q = request.query as any;
    const {
      search, status, archived, batchId, academicYear, schoolId, gradeId,
      sortBy = "createdAt", sortOrder = "desc",
      page = "1", limit = "50",
    } = q;

    const where: any = {};

    if (archived === "true")       where.isArchived = true;
    else if (archived === "false") where.isArchived = false;

    if (status && status !== "ALL") where.status = status;

    if (batchId)      where.batchId      = batchId;
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
          batch:   { select: { id: true, name: true, academicYear: true } },
          school:  { select: { id: true, name: true } },
          grade:   { select: { id: true, name: true } },
          address: true,
        },
      }),
      prisma.student.count({ where }),
      prisma.student.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.student.groupBy({ by: ["batchId"], where, _count: { _all: true } }),
    ]);

    const stats = {
      total,
      byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all])),
      batchCount: batchCounts.filter((r) => r.batchId !== null).length,
      avgBatchStrength: (() => {
        const assigned = batchCounts.filter((r) => r.batchId !== null);
        if (!assigned.length) return 0;
        return Math.round(assigned.reduce((s, r) => s + r._count._all, 0) / assigned.length);
      })(),
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
        batch:   { select: { id: true, name: true, academicYear: true, isActive: true } },
        batchAssignedAt: true,
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

    const { email, dateOfBirth, admissionDate, paymentDate, initialPassword, instalments, ...rest } = parsed.data;

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
        batch:   { select: { id: true, name: true, academicYear: true } },
        grade:   { select: { id: true, name: true } },
        course:  { select: { id: true, name: true, fee: true } },
      },
    });

    // Create instalment plan if provided
    if (instalments?.length) {
      await prisma.studentInstalment.createMany({
        data: instalments.map((ins) => ({
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

    const { dateOfBirth, admissionDate, email, batchId, ...rest } = parsed.data as any;

    if (email) {
      const conflict = await prisma.student.findFirst({ where: { email, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Email "${email}" is already in use` });
    }

    // If batch is being changed, record the old one in history
    let batchData: Record<string, any> = {};
    if (batchId !== undefined) {
      const current = await prisma.student.findUnique({
        where: { id },
        select: { batchId: true, batchAssignedAt: true, batch: { select: { name: true, academicYear: true } } },
      });
      if (current?.batchId && current.batchId !== batchId) {
        await prisma.studentBatchHistory.create({
          data: {
            studentId:   id,
            batchId:     current.batchId,
            batchName:   current.batch?.name ?? "",
            academicYear: current.batch?.academicYear ?? null,
            assignedAt:  current.batchAssignedAt ?? current.batch ? new Date() : new Date(),
            removedAt:   new Date(),
          },
        });
      }
      batchData = {
        batchId:        batchId || null,
        batchAssignedAt: batchId ? new Date() : null,
      };
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...rest,
        ...batchData,
        ...(email         ? { email }                                 : {}),
        ...(dateOfBirth   ? { dateOfBirth:   new Date(dateOfBirth)   } : {}),
        ...(admissionDate ? { admissionDate: new Date(admissionDate) } : {}),
      },
      select: {
        id: true, studentCode: true, firstName: true, lastName: true, email: true,
        phone: true, status: true, isArchived: true, createdAt: true,
        batch: { select: { id: true, name: true, academicYear: true } },
        batchAssignedAt: true,
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
}
