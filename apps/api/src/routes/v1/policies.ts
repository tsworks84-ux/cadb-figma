import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { randomUUID } from "crypto";
import { extname } from "path";
import { uploadFile } from "../../utils/s3.js";

const ALLOWED_CATEGORIES = ["HR", "FINANCE", "IT", "OPERATIONS", "COMPLIANCE", "ACADEMIC", "OTHER"] as const;

// Policy PDFs are far bigger than the 5 MB the multipart plugin allows globally,
// so this route raises its own ceiling. This must stay <= nginx's
// client_max_body_size on prod (/etc/nginx/sites-enabled/cadb, raised to 12M
// for this), since nginx rejects an oversized body with a bodyless HTML 413
// before the API ever sees it. Keep in step with MAX_POLICY_MB in the
// upload modal too.
const MAX_POLICY_BYTES = 10 * 1024 * 1024;

const createPolicySchema = z.object({
  title: z.string().min(1),
  category: z.enum(ALLOWED_CATEGORIES),
  version: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().url(),
  requiresAck: z.boolean().default(false),
  expiresAt: z.string().optional(),
});

const uploadFieldSchema = z.object({
  title: z.string().min(1),
  category: z.enum(ALLOWED_CATEGORIES),
  version: z.string().min(1),
  description: z.string().optional(),
  requiresAck: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function policyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string>;
    const policies = await prisma.policyDocument.findMany({
      where: {
        isActive: true,
        ...(query.category && { category: query.category as any }),
      },
      include: {
        _count: { select: { acknowledgements: true } },
        acknowledgements: {
          where: { employeeId: user.sub },
          select: { acknowledgedAt: true },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    const totalEmployees = await prisma.employee.count({ where: { deletedAt: null } });

    const data = policies.map((p) => ({
      ...p,
      ackCount: p._count.acknowledgements,
      totalEmployees: p.requiresAck ? totalEmployees : null,
      myAcknowledgedAt: p.acknowledgements[0]?.acknowledgedAt ?? null,
    }));

    return reply.send({ success: true, data });
  });

  // Upload a policy PDF (multipart form)
  fastify.post(
    "/upload",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") },
    async (request, reply) => {
      const fields: Record<string, string> = {};
      let pdf: Buffer | null = null;

      // Buffer the PDF rather than piping it straight to storage: the fields
      // arrive after the file, so nothing should be written until both the file
      // and the metadata are known to be good.
      // throwFileSizeLimit is honoured per-request by @fastify/multipart but is
      // missing from its per-request types, hence the cast. Turning it off lets
      // us answer with a readable message instead of a raw FST_REQ_FILE_TOO_LARGE.
      const parts = request.parts({
        limits: { fileSize: MAX_POLICY_BYTES, files: 1 },
        throwFileSizeLimit: false,
      } as any);
      for await (const part of parts) {
        if (part.type === "file") {
          const ext = extname(part.filename || "").toLowerCase();
          if (ext !== ".pdf") {
            part.file.resume();
            return reply
              .status(400)
              .send({ success: false, error: "Only PDF files are allowed", statusCode: 400 });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Buffer);
          if (part.file.truncated) {
            return reply.status(413).send({
              success: false,
              error: `File is too large. The maximum policy size is ${MAX_POLICY_BYTES / 1024 / 1024} MB.`,
              statusCode: 413,
            });
          }
          pdf = Buffer.concat(chunks);
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      if (!pdf || pdf.length === 0) {
        return reply
          .status(400)
          .send({ success: false, error: "No file uploaded", statusCode: 400 });
      }

      const parsed = uploadFieldSchema.safeParse(fields);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join(".") || "field"}: ${i.message}`)
          .join(", ");
        return reply
          .status(400)
          .send({ success: false, error: `Validation failed — ${detail}`, statusCode: 400 });
      }

      const d = parsed.data;
      const fileName = `policy_${randomUUID()}.pdf`;
      const fileUrl = await uploadFile(
        pdf,
        `uploads/policies/${fileName}`,
        "application/pdf",
        `policies/${fileName}`
      );
      const data = await prisma.policyDocument.create({
        data: {
          title: d.title,
          category: d.category,
          version: d.version,
          description: d.description,
          fileUrl,
          requiresAck: d.requiresAck === "true",
          expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
        },
      });
      return reply.status(201).send({ success: true, data });
    }
  );

  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = createPolicySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const d = parsed.data;
    const data = await prisma.policyDocument.create({
      data: { ...d, expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined },
    });
    return reply.status(201).send({ success: true, data });
  });

  fastify.delete(
    "/:id",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.policyDocument.update({ where: { id }, data: { isActive: false } });
      return reply.send({ success: true, data: null });
    }
  );

  fastify.post("/:id/acknowledge", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const policy = await prisma.policyDocument.findUnique({ where: { id } });
    if (!policy) {
      return reply.status(404).send({ success: false, error: "Policy not found", statusCode: 404 });
    }

    const data = await prisma.policyAcknowledgement.upsert({
      where: { employeeId_policyId: { employeeId: user.sub, policyId: id } },
      create: { employeeId: user.sub, policyId: id },
      update: { acknowledgedAt: new Date() },
    });
    return reply.send({ success: true, data });
  });

  fastify.get(
    "/:id/acknowledgements",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [acks, allEmployees] = await Promise.all([
        prisma.policyAcknowledgement.findMany({
          where: { policyId: id },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { acknowledgedAt: "desc" },
        }),
        prisma.employee.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
          orderBy: { employeeCode: "asc" },
        }),
      ]);

      const ackedIds = new Set(acks.map((a) => a.employeeId));
      const pending = allEmployees.filter((e) => !ackedIds.has(e.id));

      return reply.send({
        success: true,
        data: {
          acknowledged: acks,
          pending,
          counts: { acknowledged: acks.length, pending: pending.length, total: allEmployees.length },
        },
      });
    }
  );
}
