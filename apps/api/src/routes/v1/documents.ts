import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { createWriteStream, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "../../../uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const DOCUMENT_TYPES = new Set([
  "PASSPORT_PHOTO", "PAN_CARD", "AADHAAR_CARD", "ADDRESS_PROOF",
  "CERTIFICATE", "DEGREE_CERTIFICATE", "EXPERIENCE_LETTER",
  "UG_DEGREE", "PG_DEGREE", "DOCTORATE_DEGREE", "BED_DEGREE",
  "OTHER",
]);

// Only one document per employee is allowed for these types
const SINGLETON_TYPES = new Set([
  "PASSPORT_PHOTO", "PAN_CARD", "AADHAAR_CARD", "ADDRESS_PROOF",
  "UG_DEGREE", "PG_DEGREE", "DOCTORATE_DEGREE", "BED_DEGREE",
]);

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Upload a document for an employee
  fastify.post("/:employeeId/documents", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    // Employees can only upload to their own profile
    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: "No file uploaded", statusCode: 400 });
    }
    if (!ALLOWED_MIME.has(data.mimetype)) {
      return reply.status(400).send({ success: false, error: "Only PDF, JPG, PNG, WEBP allowed", statusCode: 400 });
    }

    const docType = (data.fields.type as any)?.value ?? "OTHER";
    if (!DOCUMENT_TYPES.has(docType)) {
      return reply.status(400).send({ success: false, error: "Invalid document type", statusCode: 400 });
    }
    const label = (data.fields.label as any)?.value ?? null;

    const ext = data.filename.split(".").pop() ?? "bin";
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOADS_DIR, fileName);

    let fileSize = 0;
    const chunks: Buffer[] = [];

    for await (const chunk of data.file) {
      fileSize += chunk.length;
      if (fileSize > MAX_SIZE) {
        return reply.status(413).send({ success: false, error: "File too large (max 5 MB)", statusCode: 413 });
      }
      chunks.push(chunk);
    }

    await pipeline(
      (async function* () { for (const c of chunks) yield c; })(),
      createWriteStream(filePath)
    );

    const fileUrl = `/uploads/${fileName}`;

    // For singleton types, delete any existing document of the same type first
    if (SINGLETON_TYPES.has(docType)) {
      const existing = await prisma.employeeDocument.findFirst({
        where: { employeeId, type: docType as any },
        select: { id: true, fileUrl: true },
      });
      if (existing) {
        await prisma.employeeDocument.delete({ where: { id: existing.id } });
        try { unlinkSync(join(UPLOADS_DIR, existing.fileUrl.replace("/uploads/", ""))); } catch {}
      }
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        type: docType as any,
        label,
        fileName: data.filename,
        fileUrl,
        fileSize,
        mimeType: data.mimetype,
      },
    });

    // Auto-set passport photo as profile picture only when the employee uploads their own
    if (docType === "PASSPORT_PHOTO" && user.sub === employeeId) {
      await prisma.employee.update({ where: { id: employeeId }, data: { photoUrl: fileUrl } });
    }

    return reply.status(201).send({ success: true, data: doc });
  });

  // List documents for an employee
  fastify.get("/:employeeId/documents", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const data = await prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: [{ type: "asc" }, { uploadedAt: "desc" }],
    });
    return reply.send({ success: true, data });
  });

  // Delete a document
  fastify.delete("/:employeeId/documents/:docId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId, docId } = request.params as { employeeId: string; docId: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const doc = await prisma.employeeDocument.findFirst({ where: { id: docId, employeeId } });
    if (!doc) return reply.status(404).send({ success: false, error: "Document not found", statusCode: 404 });

    await prisma.employeeDocument.delete({ where: { id: docId } });
    try { unlinkSync(join(UPLOADS_DIR, doc.fileUrl.replace("/uploads/", ""))); } catch {}
    return reply.send({ success: true, data: null, message: "Document deleted" });
  });
}
