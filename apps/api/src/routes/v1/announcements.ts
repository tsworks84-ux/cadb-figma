import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "../../../uploads");
const ANN_DIR = join(UPLOADS_DIR, "announcements");
mkdirSync(ANN_DIR, { recursive: true });

const POSTER_ROLES = ["SUPER_ADMIN", "HR_ADMIN"] as const;

const AUTHOR_SELECT = {
  firstName: true, lastName: true, photoUrl: true,
  designation: { select: { title: true } },
};

const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number(),
  type: z.string(),
});

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  type: z.enum(["GENERAL", "IMPORTANT", "URGENT"]).optional(),
  audience: z.enum(["ALL_EMPLOYEES", "MANAGERS", "HR_ONLY"]).optional(),
  pinned: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

async function getNotifiedCount(audience: string): Promise<number> {
  return prisma.employee.count({ where: { deletedAt: null, status: { not: "TERMINATED" } } });
}

export async function announcementRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Upload attachment ────────────────────────────────────────────────────
  fastify.post(
    "/upload",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ success: false, error: "No file provided", statusCode: 400 });

      const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);
      if (!allowed.has(data.mimetype)) {
        return reply.status(400).send({ success: false, error: "Only PDF, JPG, PNG allowed", statusCode: 400 });
      }

      const ext = data.filename.split(".").pop()?.toLowerCase() ?? "bin";
      const fileName = `ann_${randomUUID()}.${ext}`;
      const filePath = join(ANN_DIR, fileName);

      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) {
          return reply.status(413).send({ success: false, error: "File too large (max 5 MB)", statusCode: 413 });
        }
        chunks.push(chunk);
      }

      await pipeline(
        (async function* () { for (const c of chunks) yield c; })(),
        createWriteStream(filePath)
      );

      return reply.send({
        success: true,
        data: { name: data.filename, url: `/uploads/announcements/${fileName}`, size, type: data.mimetype },
      });
    }
  );

  // ── Published feed (all employees) ──────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const announcements = await prisma.announcement.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }],
      include: {
        postedBy: { select: AUTHOR_SELECT },
        _count: { select: { views: true, acks: true } },
      },
    });

    const ids = announcements.map((a) => a.id);
    if (ids.length > 0) {
      const [existing, ackedRows] = await Promise.all([
        prisma.announcementView.findMany({
          where: { employeeId: user.sub, announcementId: { in: ids } },
          select: { announcementId: true },
        }),
        prisma.announcementAck.findMany({
          where: { employeeId: user.sub, announcementId: { in: ids } },
          select: { announcementId: true },
        }),
      ]);
      const seen = new Set(existing.map((v) => v.announcementId));
      const ackedSet = new Set(ackedRows.map((v) => v.announcementId));
      const toInsert = ids.filter((id) => !seen.has(id));
      if (toInsert.length > 0) {
        await prisma.announcementView.createMany({
          data: toInsert.map((announcementId) => ({ announcementId, employeeId: user.sub })),
          skipDuplicates: true,
        });
      }
      return reply.send({
        success: true,
        data: announcements.map((a) => ({ ...a, acknowledged: ackedSet.has(a.id) })),
      });
    }

    return reply.send({ success: true, data: announcements.map((a) => ({ ...a, acknowledged: false })) });
  });

  // ── Acknowledge an announcement ───────────────────────────────────────────
  fastify.post("/:id/acknowledge", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const announcement = await prisma.announcement.findUnique({ where: { id, status: "PUBLISHED" } });
    if (!announcement) {
      return reply.status(404).send({ success: false, error: "Announcement not found", statusCode: 404 });
    }

    await prisma.announcementAck.upsert({
      where: { announcementId_employeeId: { announcementId: id, employeeId: user.sub } },
      create: { announcementId: id, employeeId: user.sub },
      update: {},
    });

    return reply.send({ success: true, data: null });
  });

  // ── Admin feed (all statuses + stats) ────────────────────────────────────
  fastify.get(
    "/all",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (_request, reply) => {
      const [announcements, totalEmployees] = await Promise.all([
        prisma.announcement.findMany({
          orderBy: [{ createdAt: "desc" }],
          include: {
            postedBy: { select: AUTHOR_SELECT },
            _count: { select: { views: true, acks: true } },
          },
        }),
        prisma.employee.count({ where: { deletedAt: null, status: { not: "TERMINATED" } } }),
      ]);

      const stats = {
        total: announcements.length,
        pinned: announcements.filter((a) => a.pinned).length,
        drafts: announcements.filter((a) => a.status === "DRAFT").length,
        published: announcements.filter((a) => a.status === "PUBLISHED").length,
        archived: announcements.filter((a) => a.status === "ARCHIVED").length,
        seenRate: (() => {
          const pub = announcements.filter((a) => a.status === "PUBLISHED" && a.notifiedCount > 0);
          if (!pub.length) return 0;
          const avg = pub.reduce((s, a) => s + (a._count.views / a.notifiedCount), 0) / pub.length;
          return Math.round(avg * 100);
        })(),
        totalEmployees,
      };

      return reply.send({ success: true, data: announcements, stats });
    }
  );

  // ── Admin: who acknowledged ───────────────────────────────────────────────
  fastify.get(
    "/:id/acknowledgements",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const acks = await prisma.announcementAck.findMany({
        where: { announcementId: id },
        orderBy: { ackedAt: "asc" },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true,
              photoUrl: true, employeeCode: true,
              designation: { select: { title: true } },
            },
          },
        },
      });
      return reply.send({ success: true, data: acks, count: acks.length });
    }
  );

  // ── Create ───────────────────────────────────────────────────────────────
  fastify.post(
    "/",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const body = announcementSchema.extend({ publish: z.boolean().optional() }).safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ success: false, error: body.error.issues[0].message, statusCode: 400 });
      }
      const { title, body: text, type, audience, pinned, attachments, publish } = body.data;
      const aud = audience ?? "ALL_EMPLOYEES";
      const status = publish ? "PUBLISHED" : "DRAFT";
      const notifiedCount = publish ? await getNotifiedCount(aud) : 0;

      const announcement = await prisma.announcement.create({
        data: {
          title, body: text,
          type: type ?? "GENERAL",
          audience: aud,
          status,
          pinned: pinned ?? false,
          attachments: attachments ?? [],
          publishedAt: publish ? new Date() : null,
          notifiedCount,
          postedById: user.sub,
        },
        include: { postedBy: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
      });

      return reply.status(201).send({ success: true, data: announcement });
    }
  );

  // ── Update ───────────────────────────────────────────────────────────────
  fastify.patch(
    "/:id",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.announcement.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

      const parsed = announcementSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.issues[0].message, statusCode: 400 });
      }

      const announcement = await prisma.announcement.update({
        where: { id },
        data: { ...parsed.data },
        include: { postedBy: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
      });
      return reply.send({ success: true, data: announcement });
    }
  );

  // ── Publish a draft ───────────────────────────────────────────────────────
  fastify.post(
    "/:id/publish",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.announcement.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

      const notifiedCount = await getNotifiedCount(existing.audience);
      const announcement = await prisma.announcement.update({
        where: { id },
        data: { status: "PUBLISHED", publishedAt: new Date(), notifiedCount },
        include: { postedBy: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
      });
      return reply.send({ success: true, data: announcement });
    }
  );

  // ── Archive ───────────────────────────────────────────────────────────────
  fastify.post(
    "/:id/archive",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const announcement = await prisma.announcement.update({
        where: { id },
        data: { status: "ARCHIVED", pinned: false },
        include: { postedBy: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
      });
      return reply.send({ success: true, data: announcement });
    }
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  fastify.delete(
    "/:id",
    { preHandler: requireRole(...POSTER_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.announcement.deleteMany({ where: { id } });
      return reply.send({ success: true, data: null });
    }
  );
}
