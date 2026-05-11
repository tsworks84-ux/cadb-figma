import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { generateClaimNumber } from "../../utils/claimNumber.js";
import type { JwtPayload } from "@cadb/types";
import { createWriteStream, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECEIPTS_DIR = join(__dirname, "../../../uploads/receipts");
mkdirSync(RECEIPTS_DIR, { recursive: true });

const RECEIPT_THRESHOLD_KEY = "claim_receipt_threshold";
const DEFAULT_THRESHOLD = 250;

async function getReceiptThreshold(): Promise<number> {
  const s = await prisma.appSetting.findUnique({ where: { key: RECEIPT_THRESHOLD_KEY } });
  return s ? parseFloat(s.value) : DEFAULT_THRESHOLD;
}

const createClaimSchema = z.object({
  claimType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  claimedAmount: z.number().positive(),
});

export async function claimRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Create claim (draft) ──────────────────────────────────────────────────
  fastify.post("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = createClaimSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const claimTypeCfg = await prisma.claimTypeConfig.findUnique({ where: { name: parsed.data.claimType } });
    if (!claimTypeCfg || !claimTypeCfg.isActive) {
      return reply.status(400).send({ success: false, error: "Invalid or inactive claim type", statusCode: 400 });
    }
    const data = await prisma.reimbursementClaim.create({
      data: { claimNumber: generateClaimNumber(), employeeId: user.sub, ...parsed.data, status: "DRAFT" },
      include: { receipts: true },
    });
    return reply.status(201).send({ success: true, data });
  });

  // ── Get my claims ─────────────────────────────────────────────────────────
  fastify.get("/my", async (request, reply) => {
    const user = request.user as JwtPayload;
    const data = await prisma.reimbursementClaim.findMany({
      where: { employeeId: user.sub },
      include: { receipts: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data });
  });

  // ── Get receipt threshold ─────────────────────────────────────────────────
  fastify.get("/threshold", async (_request, reply) => {
    const threshold = await getReceiptThreshold();
    return reply.send({ success: true, data: { threshold } });
  });

  // ── Update receipt threshold (admin only) ──────────────────────────────────
  fastify.patch("/threshold", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const body = request.body as { threshold?: number };
    if (!body?.threshold || body.threshold < 0) {
      return reply.status(400).send({ success: false, error: "Valid threshold amount required", statusCode: 400 });
    }
    await prisma.appSetting.upsert({
      where: { key: RECEIPT_THRESHOLD_KEY },
      create: { key: RECEIPT_THRESHOLD_KEY, value: String(body.threshold) },
      update: { value: String(body.threshold) },
    });
    return reply.send({ success: true, data: { threshold: body.threshold } });
  });

  // ── Get all claims (admin) with optional status/type filter ──────────────
  fastify.get("/admin/all", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.claimType) where.claimType = q.claimType;
    if (q.employeeId) where.employeeId = q.employeeId;

    const data = await prisma.reimbursementClaim.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        receipts: true,
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data });
  });

  // ── Get single claim ──────────────────────────────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";

    const claim = await prisma.reimbursementClaim.findFirst({
      where: isAdmin ? { id } : { id, employeeId: user.sub },
      include: {
        receipts: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!claim) return reply.status(404).send({ success: false, error: "Claim not found", statusCode: 404 });
    return reply.send({ success: true, data: claim });
  });

  // ── Upload receipt for a claim ────────────────────────────────────────────
  fastify.post("/:id/receipts", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";

    const claim = await prisma.reimbursementClaim.findFirst({
      where: isAdmin ? { id } : { id, employeeId: user.sub, status: "DRAFT" },
    });
    if (!claim) {
      return reply.status(404).send({ success: false, error: "Claim not found or not editable", statusCode: 404 });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ success: false, error: "No file uploaded", statusCode: 400 });

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(data.mimetype)) {
      return reply.status(400).send({ success: false, error: "Only images (JPG/PNG) and PDF allowed", statusCode: 400 });
    }

    const ext = data.mimetype === "application/pdf" ? ".pdf"
      : data.mimetype === "image/png" ? ".png"
      : data.mimetype === "image/webp" ? ".webp"
      : ".jpg";
    const fileName = `receipt_${randomUUID()}${ext}`;
    const filePath = join(RECEIPTS_DIR, fileName);

    await pipeline(data.file, createWriteStream(filePath));

    const receipt = await prisma.claimReceipt.create({
      data: {
        claimId: id,
        fileName: data.filename,
        fileUrl: `/uploads/receipts/${fileName}`,
        mimeType: data.mimetype,
        amount: 0,
      },
    });
    return reply.status(201).send({ success: true, data: receipt });
  });

  // ── Delete a receipt ──────────────────────────────────────────────────────
  fastify.delete("/:id/receipts/:rid", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id, rid } = request.params as { id: string; rid: string };
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";

    const claim = await prisma.reimbursementClaim.findFirst({
      where: isAdmin ? { id } : { id, employeeId: user.sub, status: "DRAFT" },
    });
    if (!claim) return reply.status(404).send({ success: false, error: "Claim not found or not editable", statusCode: 404 });

    const receipt = await prisma.claimReceipt.findFirst({ where: { id: rid, claimId: id } });
    if (!receipt) return reply.status(404).send({ success: false, error: "Receipt not found", statusCode: 404 });

    // Delete file from disk
    try {
      const filePath = join(__dirname, "../../../uploads", receipt.fileUrl.replace("/uploads/", ""));
      unlinkSync(filePath);
    } catch { /* file may already be gone */ }

    await prisma.claimReceipt.delete({ where: { id: rid } });
    return reply.send({ success: true, data: null });
  });

  // ── Submit claim for approval ──────────────────────────────────────────────
  fastify.patch("/:id/submit", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const claim = await prisma.reimbursementClaim.findFirst({
      where: { id, employeeId: user.sub, status: "DRAFT" },
      include: { receipts: true },
    });
    if (!claim) return reply.status(404).send({ success: false, error: "Claim not found", statusCode: 404 });

    // Enforce receipt requirement — by threshold OR by claim type flag
    const [threshold, claimTypeCfg] = await Promise.all([
      getReceiptThreshold(),
      prisma.claimTypeConfig.findUnique({ where: { name: claim.claimType } }),
    ]);
    const needsDoc = claimTypeCfg?.requiresDocument || claim.claimedAmount > threshold;
    if (needsDoc && claim.receipts.length === 0) {
      const reason = claimTypeCfg?.requiresDocument
        ? `${claimTypeCfg.label} claims always require a supporting document.`
        : `Claims above ₹${threshold.toLocaleString("en-IN")} require at least one supporting document.`;
      return reply.status(400).send({ success: false, error: reason, statusCode: 400 });
    }

    const updated = await prisma.reimbursementClaim.update({
      where: { id },
      data: { status: "SUBMITTED" },
      include: { receipts: true },
    });
    return reply.send({ success: true, data: updated, message: "Claim submitted for approval" });
  });

  // ── Admin: get pending claims ──────────────────────────────────────────────
  fastify.get("/pending", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const data = await prisma.reimbursementClaim.findMany({
      where: { status: "SUBMITTED" },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        receipts: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data });
  });

  // ── Admin: approve / reject ────────────────────────────────────────────────
  fastify.patch("/:id/decision", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    const body = request.body as { action: "APPROVED" | "REJECTED"; approvedAmount?: number; note?: string };

    if (!body.action || !["APPROVED", "REJECTED"].includes(body.action)) {
      return reply.status(400).send({ success: false, error: "action must be APPROVED or REJECTED", statusCode: 400 });
    }
    if (body.action === "REJECTED" && !body.note?.trim()) {
      return reply.status(400).send({ success: false, error: "Rejection note is required", statusCode: 400 });
    }

    const claim = await prisma.reimbursementClaim.findFirst({ where: { id, status: "SUBMITTED" } });
    if (!claim) return reply.status(404).send({ success: false, error: "Claim not found", statusCode: 404 });

    const updated = await prisma.reimbursementClaim.update({
      where: { id },
      data: {
        status: body.action,
        approverId: user.sub,
        approvedAmount: body.action === "APPROVED" ? (body.approvedAmount ?? claim.claimedAmount) : null,
        approvedAt: body.action === "APPROVED" ? new Date() : null,
        rejectedAt: body.action === "REJECTED" ? new Date() : null,
        rejectionNote: body.action === "REJECTED" ? body.note : (body.note ?? null),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        receipts: true,
      },
    });
    return reply.send({ success: true, data: updated });
  });

  // ── Admin: mark as paid ───────────────────────────────────────────────────
  fastify.patch("/:id/pay", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const claim = await prisma.reimbursementClaim.findFirst({ where: { id, status: "APPROVED" } });
    if (!claim) return reply.status(404).send({ success: false, error: "Approved claim not found", statusCode: 404 });

    const updated = await prisma.reimbursementClaim.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });
    return reply.send({ success: true, data: updated });
  });
}
