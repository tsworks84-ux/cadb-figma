import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { uploadFile } from "../../utils/s3.js";
import { randomUUID } from "crypto";
import type { JwtPayload } from "@cadb/types";

const THREAD_SELECT = {
  id: true, senderType: true, senderId: true, senderName: true,
  message: true, attachmentUrl: true, attachmentName: true, createdAt: true,
} as const;

const FEEDBACK_LIST_SELECT = {
  id: true, type: true, message: true, status: true,
  retractedAt: true, createdAt: true, updatedAt: true,
  student: {
    select: {
      id: true, studentCode: true,
      firstName: true, middleName: true, lastName: true, photoUrl: true, email: true,
      studentBatches: {
        select: { batch: { select: { name: true, academicYear: true } } },
        take: 1,
      },
    },
  },
  messages: { select: THREAD_SELECT, orderBy: { createdAt: "desc" as const }, take: 1 },
  _count: { select: { messages: true } },
} as const;

export async function adminFeedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Upload attachment for reply ────────────────────────────────────────────
  fastify.post("/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ success: false, error: "No file" });

    const allowed = new Set(["image/jpeg", "image/png", "application/pdf", "image/webp"]);
    if (!allowed.has(data.mimetype))
      return reply.status(400).send({ success: false, error: "Only PDF, JPG, PNG, WEBP allowed" });

    const ext = data.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const fileName = `fbk_${randomUUID()}.${ext}`;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > 10 * 1024 * 1024)
        return reply.status(400).send({ success: false, error: "File must be under 10 MB" });
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const url = await uploadFile(buffer, `feedback/${fileName}`, data.mimetype, `feedback/${fileName}`);
    return reply.send({ success: true, data: { url, name: data.filename, size } });
  });

  // ── Summary counts only (used by sidebar badge) ──────────────────────────
  fastify.get("/summary", async (_request, reply) => {
    const counts = await prisma.studentFeedback.groupBy({
      by: ["status"],
      where: { retractedAt: null },
      _count: true,
    });
    const data = Object.fromEntries(counts.map((c) => [c.status, c._count]));
    return reply.send({ success: true, data });
  });

  // ── List all feedback (non-retracted) ─────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const { status, type, search, page = "1", limit = "30" } = request.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { retractedAt: null };
    if (status) where.status = status;
    if (type)   where.type   = type;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: "insensitive" } },
        { student: { firstName: { contains: search, mode: "insensitive" } } },
        { student: { lastName:  { contains: search, mode: "insensitive" } } },
        { student: { studentCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.studentFeedback.findMany({
        where,
        select: FEEDBACK_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.studentFeedback.count({ where }),
    ]);

    // Summary counts
    const counts = await prisma.studentFeedback.groupBy({
      by: ["status"],
      where: { retractedAt: null },
      _count: true,
    });
    const summary = Object.fromEntries(counts.map((c) => [c.status, c._count]));

    return reply.send({ success: true, data: rows, total, page: parseInt(page), summary });
  });

  // ── Get single feedback with full thread ──────────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fb = await prisma.studentFeedback.findFirst({
      where: { id, retractedAt: null },
      select: {
        id: true, type: true, message: true, status: true,
        retractedAt: true, createdAt: true, updatedAt: true,
        student: {
          select: {
            id: true, studentCode: true,
            firstName: true, middleName: true, lastName: true, photoUrl: true, email: true, phone: true,
            studentBatches: {
              select: { batch: { select: { name: true, academicYear: true } } },
            },
          },
        },
        messages: { select: THREAD_SELECT, orderBy: { createdAt: "asc" } },
      },
    });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });
    return reply.send({ success: true, data: fb });
  });

  // ── Admin reply ────────────────────────────────────────────────────────────
  fastify.post("/:id/reply", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const { message, attachmentUrl, attachmentName } = request.body as any;

    if (!message?.trim())
      return reply.status(400).send({ success: false, error: "Message is required" });

    const fb = await prisma.studentFeedback.findFirst({ where: { id, retractedAt: null } });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });
    if (fb.status === "CLOSED_BY_STUDENT")
      return reply.status(400).send({ success: false, error: "Feedback was closed by the student" });

    const admin = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { firstName: true, lastName: true },
    });
    const senderName = admin ? `${admin.firstName} ${admin.lastName}` : "Admin";

    const [msg] = await prisma.$transaction([
      prisma.feedbackMessage.create({
        data: {
          feedbackId:   id,
          senderType:   "ADMIN",
          senderId:     user.sub,
          senderName,
          message:      message.trim(),
          attachmentUrl:  attachmentUrl  ?? null,
          attachmentName: attachmentName ?? null,
        },
        select: THREAD_SELECT,
      }),
      prisma.studentFeedback.update({
        where: { id },
        data:  { status: "RESPONDED", updatedAt: new Date() },
      }),
    ]);

    return reply.status(201).send({ success: true, data: msg });
  });

  // ── Admin close ───────────────────────────────────────────────────────────
  fastify.patch("/:id/close", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fb = await prisma.studentFeedback.findFirst({ where: { id, retractedAt: null } });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });

    await prisma.studentFeedback.update({ where: { id }, data: { status: "CLOSED" } });
    return reply.send({ success: true });
  });

  // ── Admin reopen ──────────────────────────────────────────────────────────
  fastify.patch("/:id/reopen", async (request, reply) => {
    const { id } = request.params as { id: string };
    const fb = await prisma.studentFeedback.findFirst({ where: { id, retractedAt: null } });
    if (!fb) return reply.status(404).send({ success: false, error: "Feedback not found" });

    await prisma.studentFeedback.update({ where: { id }, data: { status: "OPEN" } });
    return reply.send({ success: true });
  });
}
