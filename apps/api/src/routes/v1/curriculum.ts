import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { hasPermission, isAcademicsAdmin } from "../../utils/permissions.js";
import type { JwtPayload } from "@cadb/types";
import {
  buildCurriculumWorkbook, loadCurriculumWorkbook, MAX_NAME_LENGTH,
  outlineCounts, parseCurriculumWorkbook, toOutline, writeOutline,
} from "../../utils/curriculum.js";

/**
 * Academic Settings → Curriculum. A curriculum is one subject × grade × board,
 * holding a chapter → topic → subtopic outline. Reads are open to any signed-in
 * user (exam forms read outlines as topic choices); writes need ACA_SETTINGS
 * edit, the same gate as the rest of Academic Settings.
 */

const curriculumSchema = z.object({
  subjectId: z.string().min(1),
  gradeId:   z.string().min(1),
  board:     z.string().trim().min(1).max(60),
});

const itemName = z.string().trim().min(1, "Name is required").max(MAX_NAME_LENGTH);

const CHILD_LEVEL = { CHAPTER: "TOPIC", TOPIC: "SUBTOPIC" } as const;
const ITEM_SELECT = { id: true, parentId: true, level: true, name: true, sortOrder: true } as const;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

export async function curriculumRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method === "GET") return;
    const user = request.user as JwtPayload;
    const allowed = isAcademicsAdmin(user.role) || await hasPermission(user, "ACA_SETTINGS", "canEdit");
    if (!allowed) return reply.status(403).send({ success: false, error: "Insufficient permissions", statusCode: 403 });
  });

  const fail = (reply: any, status: number, error: string) => reply.status(status).send({ success: false, error });

  // ── List ────────────────────────────────────────────────────────────────────
  fastify.get("/curricula", async (request, reply) => {
    const q = request.query as { subjectId?: string; gradeId?: string; all?: string };
    const curricula = await prisma.curriculum.findMany({
      where: {
        ...(q.subjectId ? { subjectId: q.subjectId } : {}),
        ...(q.gradeId ? { gradeId: q.gradeId } : {}),
        ...(q.all === "true" ? {} : { isActive: true }),
      },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        grade:   { select: { id: true, name: true, sortOrder: true } },
      },
    });
    const counts = await prisma.curriculumItem.groupBy({
      by: ["curriculumId", "level"],
      where: { curriculumId: { in: curricula.map((c) => c.id) } },
      _count: { _all: true },
    });
    const countOf = (id: string, level: string) => counts.find((c) => c.curriculumId === id && c.level === level)?._count._all ?? 0;
    const data = curricula
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name) || a.grade.sortOrder - b.grade.sortOrder || a.board.localeCompare(b.board))
      .map((c) => ({ ...c, counts: { chapters: countOf(c.id, "CHAPTER"), topics: countOf(c.id, "TOPIC"), subtopics: countOf(c.id, "SUBTOPIC") } }));
    return reply.send({ success: true, data });
  });

  // Distinct boards in use, for the board picker's suggestions.
  fastify.get("/curricula/boards", async (_request, reply) => {
    const rows = await prisma.curriculum.findMany({ distinct: ["board"], select: { board: true }, orderBy: { board: "asc" } });
    return reply.send({ success: true, data: rows.map((r) => r.board) });
  });

  // Nested outlines for a subject, for topic pickers (e.g. New Exam). Optional
  // gradeIds narrows to the grades of the batches being examined.
  fastify.get("/curricula/outline", async (request, reply) => {
    const q = request.query as { subjectId?: string; gradeIds?: string };
    if (!q.subjectId) return fail(reply, 400, "subjectId is required");
    const gradeIds = (q.gradeIds ?? "").split(",").filter(Boolean);
    const curricula = await prisma.curriculum.findMany({
      where: { subjectId: q.subjectId, isActive: true, ...(gradeIds.length ? { gradeId: { in: gradeIds } } : {}) },
      include: { grade: { select: { id: true, name: true, sortOrder: true } }, items: { select: ITEM_SELECT } },
    });
    const data = curricula
      .sort((a, b) => a.grade.sortOrder - b.grade.sortOrder || a.board.localeCompare(b.board))
      .map((c) => ({ id: c.id, board: c.board, grade: { id: c.grade.id, name: c.grade.name }, chapters: toOutline(c.items) }));
    return reply.send({ success: true, data });
  });

  fastify.get("/curricula/template", async (_request, reply) => {
    const buf = await buildCurriculumWorkbook().xlsx.writeBuffer();
    reply.header("Content-Type", XLSX);
    reply.header("Content-Disposition", `attachment; filename="curriculum_import_template.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  // ── One curriculum ──────────────────────────────────────────────────────────
  fastify.get("/curricula/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const c = await prisma.curriculum.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        grade:   { select: { id: true, name: true } },
        items:   { select: ITEM_SELECT, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!c) return fail(reply, 404, "Curriculum not found");
    return reply.send({ success: true, data: c });
  });

  fastify.get("/curricula/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const c = await prisma.curriculum.findUnique({
      where: { id },
      include: { subject: { select: { name: true } }, grade: { select: { name: true } }, items: { select: ITEM_SELECT } },
    });
    if (!c) return fail(reply, 404, "Curriculum not found");
    const title = `${c.subject.name} · ${c.grade.name} · ${c.board}`;
    const buf = await buildCurriculumWorkbook(toOutline(c.items), title).xlsx.writeBuffer();
    reply.header("Content-Type", XLSX);
    reply.header("Content-Disposition", `attachment; filename="curriculum_${fileSafe(`${c.subject.name}_${c.grade.name}_${c.board}`)}.xlsx"`);
    return reply.send(Buffer.from(buf));
  });

  fastify.post("/curricula", async (request, reply) => {
    const parsed = curriculumSchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.errors[0].message);
    const dup = await prisma.curriculum.findUnique({ where: { subjectId_gradeId_board: parsed.data } });
    if (dup) return fail(reply, 409, "A curriculum for this subject, grade and board already exists");
    const c = await prisma.curriculum.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: c });
  });

  fastify.patch("/curricula/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = curriculumSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.errors[0].message);
    const current = await prisma.curriculum.findUnique({ where: { id } });
    if (!current) return fail(reply, 404, "Curriculum not found");
    const key = { subjectId: parsed.data.subjectId ?? current.subjectId, gradeId: parsed.data.gradeId ?? current.gradeId, board: parsed.data.board ?? current.board };
    const dup = await prisma.curriculum.findUnique({ where: { subjectId_gradeId_board: key } });
    if (dup && dup.id !== id) return fail(reply, 409, "A curriculum for this subject, grade and board already exists");
    const c = await prisma.curriculum.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: c });
  });

  fastify.delete("/curricula/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.curriculum.delete({ where: { id } }).catch(() => null);
    return reply.send({ success: true });
  });

  // ── Rows ────────────────────────────────────────────────────────────────────
  // Adds a chapter (no parentId), or a topic / subtopic under the given parent.
  fastify.post("/curricula/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ parentId: z.string().nullable().optional(), name: itemName }).safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.errors[0].message);
    const parentId = parsed.data.parentId ?? null;

    let level: "CHAPTER" | "TOPIC" | "SUBTOPIC" = "CHAPTER";
    if (parentId) {
      const parent = await prisma.curriculumItem.findUnique({ where: { id: parentId } });
      if (!parent || parent.curriculumId !== id) return fail(reply, 404, "Parent row not found");
      if (parent.level === "SUBTOPIC") return fail(reply, 400, "Subtopics can't have rows under them");
      level = CHILD_LEVEL[parent.level];
    } else if (!(await prisma.curriculum.findUnique({ where: { id }, select: { id: true } }))) {
      return fail(reply, 404, "Curriculum not found");
    }
    const siblings = await prisma.curriculumItem.findMany({ where: { curriculumId: id, parentId }, select: { name: true, sortOrder: true } });
    if (siblings.some((s) => s.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      return fail(reply, 409, `"${parsed.data.name}" is already there`);
    }
    const item = await prisma.curriculumItem.create({
      data: { curriculumId: id, parentId, level, name: parsed.data.name, sortOrder: siblings.reduce((m, s) => Math.max(m, s.sortOrder + 1), 0) },
      select: ITEM_SELECT,
    });
    await prisma.curriculum.update({ where: { id }, data: { updatedAt: new Date() } });
    return reply.status(201).send({ success: true, data: item });
  });

  // Rename, or move one place up / down among its siblings.
  fastify.patch("/curricula/items/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const parsed = z.object({ name: itemName.optional(), move: z.enum(["up", "down"]).optional() }).safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.errors[0].message);
    const item = await prisma.curriculumItem.findUnique({ where: { id: itemId } });
    if (!item) return fail(reply, 404, "Row not found");

    if (parsed.data.name && parsed.data.name !== item.name) {
      const clash = await prisma.curriculumItem.findFirst({
        where: { curriculumId: item.curriculumId, parentId: item.parentId, id: { not: item.id }, name: { equals: parsed.data.name, mode: "insensitive" } },
      });
      if (clash) return fail(reply, 409, `"${parsed.data.name}" is already there`);
      await prisma.curriculumItem.update({ where: { id: itemId }, data: { name: parsed.data.name } });
    }
    if (parsed.data.move) {
      const siblings = await prisma.curriculumItem.findMany({
        where: { curriculumId: item.curriculumId, parentId: item.parentId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true },
      });
      const at = siblings.findIndex((s) => s.id === itemId);
      const to = parsed.data.move === "up" ? at - 1 : at + 1;
      if (to >= 0 && to < siblings.length) {
        [siblings[at], siblings[to]] = [siblings[to], siblings[at]];
        // Renumber the whole sibling list: imported rows can share a sortOrder.
        await prisma.$transaction(siblings.map((s, i) => prisma.curriculumItem.update({ where: { id: s.id }, data: { sortOrder: i } })));
      }
    }
    await prisma.curriculum.update({ where: { id: item.curriculumId }, data: { updatedAt: new Date() } });
    return reply.send({ success: true });
  });

  // Deletes the row and everything under it.
  fastify.delete("/curricula/items/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const item = await prisma.curriculumItem.findUnique({ where: { id: itemId }, select: { curriculumId: true } });
    if (!item) return reply.send({ success: true });
    await prisma.curriculumItem.delete({ where: { id: itemId } });
    await prisma.curriculum.update({ where: { id: item.curriculumId }, data: { updatedAt: new Date() } });
    return reply.send({ success: true });
  });

  // ── Import ──────────────────────────────────────────────────────────────────
  // Upload a filled template for subjectId + gradeId + board (created if it
  // doesn't exist). mode=replace (default) swaps the whole outline; mode=append
  // merges by name. dryRun=true validates and returns counts + a preview only.
  fastify.post("/curricula/import", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const dryRun = q.dryRun === "true";
    const mode = q.mode === "append" ? "append" : "replace";
    const target = curriculumSchema.safeParse(q);
    if (!target.success) return fail(reply, 400, "Choose a subject, grade and board first");

    const [subject, grade] = await Promise.all([
      prisma.subject.findUnique({ where: { id: target.data.subjectId }, select: { id: true } }),
      prisma.grade.findUnique({ where: { id: target.data.gradeId }, select: { id: true } }),
    ]);
    if (!subject || !grade) return fail(reply, 400, "That subject or grade no longer exists");

    const upload = await request.file().catch(() => null);
    if (!upload) return fail(reply, 400, "No file was uploaded");
    if (!/\.(xlsx|csv)$/i.test(upload.filename)) return fail(reply, 400, "Upload the .xlsx template (or a .csv with Chapter, Topic, Subtopic columns)");
    let buffer: Buffer;
    try { buffer = await upload.toBuffer(); } catch { return fail(reply, 400, "The file is larger than 5 MB"); }

    let parsed;
    try {
      parsed = parseCurriculumWorkbook(await loadCurriculumWorkbook(buffer, upload.filename));
    } catch {
      return fail(reply, 400, "That file could not be read as a spreadsheet. Use the downloaded template.");
    }
    const { outline, errors, totalRows } = parsed;
    const counts = outlineCounts(outline);
    const existing = await prisma.curriculum.findUnique({ where: { subjectId_gradeId_board: target.data }, select: { id: true, _count: { select: { items: true } } } });

    if (dryRun) {
      return reply.send({
        success: true,
        data: {
          dryRun: true, totalRows, counts, errors, mode,
          existingRows: existing?._count.items ?? 0,
          preview: outline.slice(0, 8).map((c) => ({ name: c.name, topics: c.topics.slice(0, 6).map((t) => t.name), moreTopics: Math.max(0, c.topics.length - 6) })),
        },
      });
    }
    if (errors.length) return reply.status(400).send({ success: false, error: `${errors.length} problem${errors.length === 1 ? "" : "s"} found — nothing was imported`, data: { errors } });
    if (!outline.length) return fail(reply, 400, "The sheet has no chapters to import");

    const result = await prisma.$transaction(async (tx) => {
      const c = existing
        ? await tx.curriculum.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
        : await tx.curriculum.create({ data: target.data });
      const added = await writeOutline(tx, c.id, outline, mode);
      return { id: c.id, added, created: !existing };
    }, { timeout: 60_000, maxWait: 15_000 });

    return reply.status(201).send({ success: true, data: { ...result, counts, mode } });
  });
}
