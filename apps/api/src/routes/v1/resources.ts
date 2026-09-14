import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { Readable } from "stream";
import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";
import { authenticate } from "../../middleware/authenticate.js";
import { recordAudit } from "../../utils/auditLog.js";
import {
  DriveError, createFolder, createUploadSession, findByItemId, getFile,
  isDriveConfigured, moveFile, renameFile, streamFile, trashFile,
} from "../../utils/drive.js";

/**
 * Resources — the teaching-material library.
 *
 * Access model (module RESOURCES in the permission matrix):
 *   canView    open the library and see what is shared with you
 *   canCreate  add your own resources and categories
 *   canEdit    edit / add items to ANYONE's shared resource, rename categories
 *   canDelete  delete ANYONE's shared resource or item, delete empty categories
 *   canApprove hide / unhide ANYONE's shared resource or item ("Hide" in the UI)
 *
 * An owner can always edit, delete and hide their own resource. Holding any of
 * the three "anyone's" grants makes you a moderator, and moderators — Super
 * Admins included — see every shared resource, hidden or not, whatever its
 * department scope. PRIVATE resources are the owner's alone: nobody else, Super
 * Admin included, can list, open or moderate them.
 */

const MODULE = "RESOURCES";
const MAX_UPLOAD_BYTES = Number(process.env.RESOURCE_MAX_UPLOAD_MB ?? 1024) * 1024 * 1024;
const STREAM_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|bmp|avif)|application\/pdf|video\/|audio\/|text\/(plain|csv))\b/i;
// Uploading a folder makes two or three calls per file, which the global
// 100/minute limit would cut off part-way through.
const BULK = { config: { rateLimit: { max: 1000, timeWindow: "1 minute" } } };
const WEB_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "https://cadb.centumacademy.com",
  "http://65.0.41.55:3002",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

type ResourceWhere = NonNullable<NonNullable<Parameters<typeof prisma.resource.findMany>[0]>["where"]>;

// ─── Access ──────────────────────────────────────────────────────────────────

interface Access {
  userId: string;
  canView: boolean;
  canCreate: boolean;
  canEditAny: boolean;
  canDeleteAny: boolean;
  canHideAny: boolean;
  /** Sees every non-private resource, hidden or not. */
  moderator: boolean;
  deptIds: string[];
}

async function loadAccess(user: Pick<JwtPayload, "sub" | "role">): Promise<Access> {
  const isSA = user.role === "SUPER_ADMIN";
  const [perm, emp] = await Promise.all([
    isSA ? null : prisma.rolePermission.findUnique({
      where: { role_module: { role: user.role, module: MODULE } },
    }),
    prisma.employee.findUnique({
      where: { id: user.sub },
      select: { departmentId: true, deptMemberships: { select: { departmentId: true } } },
    }),
  ]);
  // Same rule as hasPermission: SUPER_ADMIN's grants are implicit.
  const has = (flag: "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove") =>
    isSA || (perm?.[flag] ?? false);
  const deptIds = [...new Set([
    ...(emp?.departmentId ? [emp.departmentId] : []),
    ...(emp?.deptMemberships.map((m) => m.departmentId) ?? []),
  ])];
  const canEditAny = has("canEdit");
  const canDeleteAny = has("canDelete");
  const canHideAny = has("canApprove");
  return {
    userId: user.sub,
    canView: has("canView"),
    canCreate: has("canCreate"),
    canEditAny, canDeleteAny, canHideAny,
    moderator: isSA || canEditAny || canDeleteAny || canHideAny,
    deptIds,
  };
}

/** Resources this user may see. Owners always see their own. */
function visibleWhere(a: Access): ResourceWhere {
  const shared: ResourceWhere = a.moderator
    ? { visibility: { not: "PRIVATE" } }
    : {
        isHidden: false,
        OR: [
          { visibility: "ALL_STAFF" },
          { visibility: "DEPARTMENTS", departments: { some: { departmentId: { in: a.deptIds } } } },
        ],
      };
  return { deletedAt: null, OR: [{ ownerId: a.userId }, shared] };
}

type ResourceRow = { ownerId: string; visibility: string };

const isOwner = (a: Access, r: ResourceRow) => r.ownerId === a.userId;
// A moderator's reach stops at PRIVATE — those are never "shared".
const shared = (r: ResourceRow) => r.visibility !== "PRIVATE";
const canManage = (a: Access, r: ResourceRow) => isOwner(a, r) || (a.canEditAny && shared(r));
const canDelete = (a: Access, r: ResourceRow) => isOwner(a, r) || (a.canDeleteAny && shared(r));
const canHide = (a: Access, r: ResourceRow) => isOwner(a, r) || (a.canHideAny && shared(r));
/** Hidden items inside a resource are shown to whoever could unhide them. */
const seesHidden = (a: Access, r: ResourceRow) => isOwner(a, r) || (a.moderator && shared(r));

function permsFor(a: Access, r: ResourceRow) {
  return { canManage: canManage(a, r), canDelete: canDelete(a, r), canHide: canHide(a, r), isOwner: isOwner(a, r) };
}

const fail = (reply: FastifyReply, statusCode: number, error: string) =>
  reply.status(statusCode).send({ success: false, error, statusCode });

async function findVisibleResource(a: Access, id: string) {
  return prisma.resource.findFirst({ where: { AND: [{ id }, visibleWhere(a)] } });
}

/** Loads an item plus its resource, or null when the user can't see either. */
async function findVisibleItem(a: Access, itemId: string) {
  const item = await prisma.resourceItem.findFirst({
    where: { id: itemId, deletedAt: null },
    include: { resource: true },
  });
  if (!item) return null;
  const resource = await findVisibleResource(a, item.resourceId);
  if (!resource) return null;
  if (!seesHidden(a, resource) && await isHiddenInTree(item.id)) return null;
  return { item, resource };
}

/** True when the item or any folder above it is hidden or deleted. */
async function isHiddenInTree(itemId: string | null): Promise<boolean> {
  let id = itemId;
  for (let depth = 0; id && depth < 50; depth++) {
    const row = await prisma.resourceItem.findUnique({
      where: { id },
      select: { parentId: true, isHidden: true, deletedAt: true },
    });
    if (!row || row.isHidden || row.deletedAt) return true;
    id = row.parentId;
  }
  return false;
}

/** Every descendant of the given item ids (not including them). */
async function descendantIds(resourceId: string, rootIds: string[]): Promise<string[]> {
  const all = await prisma.resourceItem.findMany({
    where: { resourceId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const byParent = new Map<string, string[]>();
  for (const r of all) {
    if (!r.parentId) continue;
    byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r.id]);
  }
  const out: string[] = [];
  const stack = [...rootIds];
  while (stack.length) {
    const kids = byParent.get(stack.pop()!) ?? [];
    out.push(...kids);
    stack.push(...kids);
  }
  return out;
}

// ─── Drive folder mirroring ──────────────────────────────────────────────────
// Drive mirrors Category / Resource / Folder so the Shared Drive stays browsable
// on its own. Folders are created lazily, and a conditional write settles the
// race when two uploads try to create the same folder at once.

async function ensureCategoryFolder(categoryId: string): Promise<string> {
  const cat = await prisma.resourceCategory.findUniqueOrThrow({ where: { id: categoryId } });
  if (cat.driveFolderId) return cat.driveFolderId;
  const created = await createFolder(cat.name);
  const won = await prisma.resourceCategory.updateMany({
    where: { id: categoryId, driveFolderId: null },
    data: { driveFolderId: created },
  });
  if (won.count) return created;
  await trashFile(created).catch(() => {});
  return (await prisma.resourceCategory.findUniqueOrThrow({ where: { id: categoryId } })).driveFolderId!;
}

async function ensureResourceFolder(resourceId: string): Promise<string> {
  const res = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } });
  if (res.driveFolderId) return res.driveFolderId;
  const parent = await ensureCategoryFolder(res.categoryId);
  const created = await createFolder(res.title, parent);
  const won = await prisma.resource.updateMany({
    where: { id: resourceId, driveFolderId: null },
    data: { driveFolderId: created },
  });
  if (won.count) return created;
  await trashFile(created).catch(() => {});
  return (await prisma.resource.findUniqueOrThrow({ where: { id: resourceId } })).driveFolderId!;
}

async function ensureItemFolder(folderItemId: string | null, resourceId: string): Promise<string> {
  if (!folderItemId) return ensureResourceFolder(resourceId);
  const folder = await prisma.resourceItem.findUniqueOrThrow({ where: { id: folderItemId } });
  if (folder.driveFileId) return folder.driveFileId;
  const parent = await ensureItemFolder(folder.parentId, resourceId);
  const created = await createFolder(folder.name, parent);
  const won = await prisma.resourceItem.updateMany({
    where: { id: folderItemId, driveFileId: null },
    data: { driveFileId: created },
  });
  if (won.count) return created;
  await trashFile(created).catch(() => {});
  return (await prisma.resourceItem.findUniqueOrThrow({ where: { id: folderItemId } })).driveFileId!;
}

/** Drive side-effects that must not fail the request that caused them. */
function driveBestEffort(request: FastifyRequest, what: string, fn: () => Promise<unknown>) {
  if (!isDriveConfigured()) return;
  fn().catch((err) => request.log.error({ err }, `Drive: ${what} failed`));
}

// ─── Stream tokens ───────────────────────────────────────────────────────────
// <video>/<img>/<iframe> can't send an Authorization header, so opening a file
// hands out a short-lived signed URL. Deliberately NOT a JWT signed with the app
// secret: a JWT would double as a bearer token for the whole API.

const streamKey = () => `${process.env.JWT_SECRET}:resource-stream`;

function signStreamToken(itemId: string, user: JwtPayload): string {
  const body = Buffer.from(JSON.stringify({
    i: itemId, u: user.sub, r: user.role, e: Date.now() + STREAM_TOKEN_TTL_MS,
  })).toString("base64url");
  const sig = createHmac("sha256", streamKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyStreamToken(token: string): { itemId: string; sub: string; role: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", streamKey()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p.e !== "number" || p.e < Date.now()) return null;
    return { itemId: p.i, sub: p.u, role: p.r };
  } catch {
    return null;
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const visibilitySchema = z.enum(["PRIVATE", "ALL_STAFF", "DEPARTMENTS"]);

const resourceSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.string().min(1, "Category is required"),
  visibility: visibilitySchema,
  departmentIds: z.array(z.string()).default([]),
}).refine((d) => d.visibility !== "DEPARTMENTS" || d.departmentIds.length > 0, {
  message: "Pick at least one department", path: ["departmentIds"],
});

const nameSchema = z.string().trim().min(1, "Name is required").max(250);

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Validation failed";
}

const serializeItem = (i: {
  id: string; parentId: string | null; kind: string; name: string; url: string | null;
  mimeType: string | null; sizeBytes: bigint | null; isHidden: boolean; createdAt: Date;
  createdBy?: { firstName: string; lastName: string } | null;
}) => ({
  id: i.id, parentId: i.parentId, kind: i.kind, name: i.name, url: i.url,
  mimeType: i.mimeType, sizeBytes: i.sizeBytes == null ? null : Number(i.sizeBytes),
  isHidden: i.isHidden, createdAt: i.createdAt,
  createdBy: i.createdBy ? `${i.createdBy.firstName} ${i.createdBy.lastName}`.trim() : null,
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function resourceRoutes(fastify: FastifyInstance) {
  // The stream URL carries its own signed token and is hit repeatedly by video
  // players seeking through a file, so it skips both auth and the rate limit.
  // A wildcard, not "/:token": the router refuses path parameters over 100
  // characters, and a signed token is longer than that.
  fastify.get("/stream/*", { config: { rateLimit: false } }, async (request, reply) => {
    const token = (request.params as Record<string, string>)["*"];
    const claims = verifyStreamToken(token);
    if (!claims) return fail(reply, 401, "This link has expired. Open the file again.");

    // Re-check access on every request so hiding or deleting takes effect at once.
    const a = await loadAccess({ sub: claims.sub, role: claims.role } as JwtPayload);
    if (!a.canView) return fail(reply, 403, "Insufficient permissions");
    const found = await findVisibleItem(a, claims.itemId);
    if (!found || found.item.kind !== "FILE" || found.item.status !== "READY" || !found.item.driveFileId) {
      return fail(reply, 404, "File not found");
    }

    const range = request.headers.range;
    const upstream = await streamFile(found.item.driveFileId, typeof range === "string" ? range : undefined);
    reply.status(upstream.status);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) reply.header(h, v);
    }
    const mime = found.item.mimeType || upstream.headers.get("content-type") || "application/octet-stream";
    reply.header("content-type", mime);
    // Only types a browser renders passively open inline. Anything else (HTML, SVG,
    // Flash…) downloads, so an uploaded file can never run as a page on our origin.
    const q = request.query as { download?: string };
    const inline = !q.download && INLINE_SAFE.test(mime);
    reply.header("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(found.item.name)}`);
    if (!inline) reply.header("content-security-policy", "sandbox; default-src 'none'");
    reply.header("cache-control", "private, max-age=3600");
    reply.header("x-content-type-options", "nosniff");
    return reply.send(Readable.fromWeb(upstream.body as any));
  });

  fastify.register(async (app) => {
    app.addHook("preHandler", authenticate);
    // Every authenticated route needs the library itself.
    app.addHook("preHandler", async (request, reply) => {
      const a = await loadAccess(request.user as JwtPayload);
      if (!a.canView) return fail(reply, 403, "Insufficient permissions");
      (request as any).resourceAccess = a;
    });
    const access = (request: FastifyRequest) => (request as any).resourceAccess as Access;

    // ── Library metadata ───────────────────────────────────────────────────────
    app.get("/meta", async (request, reply) => {
      const a = access(request);
      const [categories, counts, departments] = await Promise.all([
        prisma.resourceCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
        prisma.resource.groupBy({ by: ["categoryId"], where: visibleWhere(a), _count: true }),
        prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ]);
      const countBy = new Map(counts.map((c) => [c.categoryId, c._count]));
      return reply.send({
        success: true,
        data: {
          categories: categories.map((c) => ({
            id: c.id, name: c.name, isDefault: c.isDefault, count: countBy.get(c.id) ?? 0,
          })),
          departments,
          myDepartmentIds: a.deptIds,
          permissions: {
            canCreate: a.canCreate, canEditAny: a.canEditAny,
            canDeleteAny: a.canDeleteAny, canHideAny: a.canHideAny, moderator: a.moderator,
          },
          driveConfigured: isDriveConfigured(),
          maxUploadBytes: MAX_UPLOAD_BYTES,
        },
      });
    });

    // ── Categories ─────────────────────────────────────────────────────────────
    app.post("/categories", async (request, reply) => {
      const a = access(request);
      if (!a.canCreate) return fail(reply, 403, "Insufficient permissions");
      const parsed = z.object({ name: nameSchema.max(60) }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const clash = await prisma.resourceCategory.findFirst({
        where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      });
      if (clash) return fail(reply, 409, `A category called "${clash.name}" already exists`);
      const data = await prisma.resourceCategory.create({
        data: { name: parsed.data.name, createdById: a.userId },
      });
      return reply.status(201).send({ success: true, data });
    });

    app.patch("/categories/:id", async (request, reply) => {
      const a = access(request);
      if (!a.canEditAny) return fail(reply, 403, "Insufficient permissions");
      const { id } = request.params as { id: string };
      const parsed = z.object({ name: nameSchema.max(60) }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const clash = await prisma.resourceCategory.findFirst({
        where: { id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } },
      });
      if (clash) return fail(reply, 409, `A category called "${clash.name}" already exists`);
      const data = await prisma.resourceCategory.update({ where: { id }, data: { name: parsed.data.name } });
      if (data.driveFolderId) {
        driveBestEffort(request, "rename category folder", () => renameFile(data.driveFolderId!, data.name));
      }
      return reply.send({ success: true, data });
    });

    app.delete("/categories/:id", async (request, reply) => {
      const a = access(request);
      if (!a.canDeleteAny) return fail(reply, 403, "Insufficient permissions");
      const { id } = request.params as { id: string };
      const cat = await prisma.resourceCategory.findUnique({ where: { id } });
      if (!cat) return fail(reply, 404, "Category not found");
      if (cat.isDefault) return fail(reply, 400, "Built-in categories can be renamed but not deleted");
      // Counts private resources too — a category can't vanish from under its owner.
      const inUse = await prisma.resource.count({ where: { categoryId: id, deletedAt: null } });
      if (inUse) return fail(reply, 409, `Move or delete the ${inUse} resource(s) in this category first`);
      // Soft-deleted resources still reference the category; park them elsewhere.
      await prisma.resource.updateMany({ where: { categoryId: id }, data: { categoryId: "rescat_reference" } });
      await prisma.resourceCategory.delete({ where: { id } });
      if (cat.driveFolderId) driveBestEffort(request, "trash category folder", () => trashFile(cat.driveFolderId!));
      return reply.send({ success: true, data: null });
    });

    // ── Resources ──────────────────────────────────────────────────────────────
    app.get("/", async (request, reply) => {
      const a = access(request);
      const q = request.query as { categoryId?: string; q?: string; scope?: string };
      const and: ResourceWhere[] = [visibleWhere(a)];
      if (q.categoryId) and.push({ categoryId: q.categoryId });
      if (q.scope === "mine") and.push({ ownerId: a.userId });
      if (q.scope === "shared") and.push({ ownerId: { not: a.userId } });
      if (q.q?.trim()) {
        const term = q.q.trim();
        and.push({
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { items: { some: { deletedAt: null, status: "READY", name: { contains: term, mode: "insensitive" } } } },
          ],
        });
      }
      const rows = await prisma.resource.findMany({
        where: { AND: and },
        include: {
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          departments: { select: { department: { select: { id: true, name: true } } } },
          _count: { select: { items: { where: { deletedAt: null, status: "READY", kind: { not: "FOLDER" } } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      });
      const data = rows.map((r) => ({
        id: r.id, title: r.title, description: r.description,
        category: r.category, visibility: r.visibility, isHidden: r.isHidden,
        owner: { id: r.owner.id, name: `${r.owner.firstName} ${r.owner.lastName}`.trim() },
        departments: r.departments.map((d) => d.department),
        itemCount: r._count.items,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
        ...permsFor(a, r),
      }));
      return reply.send({ success: true, data });
    });

    app.post("/", async (request, reply) => {
      const a = access(request);
      if (!a.canCreate) return fail(reply, 403, "Insufficient permissions");
      const parsed = resourceSchema.safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const d = parsed.data;
      if (!await prisma.resourceCategory.findUnique({ where: { id: d.categoryId } })) {
        return fail(reply, 400, "Category not found");
      }
      const data = await prisma.resource.create({
        data: {
          title: d.title, description: d.description || null, categoryId: d.categoryId,
          ownerId: a.userId, visibility: d.visibility,
          departments: d.visibility === "DEPARTMENTS"
            ? { create: [...new Set(d.departmentIds)].map((departmentId) => ({ departmentId })) }
            : undefined,
        },
      });
      return reply.status(201).send({ success: true, data });
    });

    app.get("/:id", async (request, reply) => {
      const a = access(request);
      const { id } = request.params as { id: string };
      const r = await prisma.resource.findFirst({
        where: { AND: [{ id }, visibleWhere(a)] },
        include: {
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          departments: { select: { department: { select: { id: true, name: true } } } },
          items: {
            where: { deletedAt: null, status: "READY" },
            include: { createdBy: { select: { firstName: true, lastName: true } } },
            orderBy: [{ kind: "asc" }, { name: "asc" }],
          },
        },
      });
      if (!r) return fail(reply, 404, "Resource not found");

      let items = r.items;
      if (!seesHidden(a, r)) {
        // Drop hidden items and everything inside a hidden folder.
        const hidden = items.filter((i) => i.isHidden).map((i) => i.id);
        const gone = new Set([...hidden, ...await descendantIds(r.id, hidden)]);
        items = items.filter((i) => !gone.has(i.id));
      }
      return reply.send({
        success: true,
        data: {
          id: r.id, title: r.title, description: r.description,
          category: r.category, visibility: r.visibility, isHidden: r.isHidden,
          owner: { id: r.owner.id, name: `${r.owner.firstName} ${r.owner.lastName}`.trim() },
          departments: r.departments.map((d) => d.department),
          createdAt: r.createdAt, updatedAt: r.updatedAt,
          items: items.map(serializeItem),
          ...permsFor(a, r),
        },
      });
    });

    app.patch("/:id", async (request, reply) => {
      const a = access(request);
      const { id } = request.params as { id: string };
      const existing = await findVisibleResource(a, id);
      if (!existing) return fail(reply, 404, "Resource not found");
      if (!canManage(a, existing)) return fail(reply, 403, "Insufficient permissions");
      const parsed = resourceSchema.safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const d = parsed.data;
      // Only the owner may make a resource private — a moderator doing it would
      // lock the resource away from themselves and every other moderator.
      if (d.visibility === "PRIVATE" && !isOwner(a, existing) && existing.visibility !== "PRIVATE") {
        return fail(reply, 403, "Only the owner can make a resource private");
      }
      if (!await prisma.resourceCategory.findUnique({ where: { id: d.categoryId } })) {
        return fail(reply, 400, "Category not found");
      }
      const data = await prisma.$transaction(async (tx) => {
        await tx.resourceDepartment.deleteMany({ where: { resourceId: id } });
        return tx.resource.update({
          where: { id },
          data: {
            title: d.title, description: d.description || null, categoryId: d.categoryId,
            visibility: d.visibility,
            departments: d.visibility === "DEPARTMENTS"
              ? { create: [...new Set(d.departmentIds)].map((departmentId) => ({ departmentId })) }
              : undefined,
          },
        });
      });
      if (existing.driveFolderId) {
        const folderId = existing.driveFolderId;
        if (existing.title !== d.title) {
          driveBestEffort(request, "rename resource folder", () => renameFile(folderId, d.title));
        }
        if (existing.categoryId !== d.categoryId) {
          driveBestEffort(request, "move resource folder", async () =>
            moveFile(folderId, await ensureCategoryFolder(d.categoryId)));
        }
      }
      return reply.send({ success: true, data });
    });

    app.post("/:id/hide", async (request, reply) => {
      const a = access(request);
      const { id } = request.params as { id: string };
      const existing = await findVisibleResource(a, id);
      if (!existing) return fail(reply, 404, "Resource not found");
      if (!canHide(a, existing)) return fail(reply, 403, "Insufficient permissions");
      const parsed = z.object({ hidden: z.boolean() }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, "Validation failed");
      const data = await prisma.resource.update({
        where: { id },
        data: parsed.data.hidden
          ? { isHidden: true, hiddenAt: new Date(), hiddenById: a.userId }
          : { isHidden: false, hiddenAt: null, hiddenById: null },
      });
      return reply.send({ success: true, data });
    });

    app.delete("/:id", async (request, reply) => {
      const a = access(request);
      const { id } = request.params as { id: string };
      const existing = await prisma.resource.findFirst({
        where: { AND: [{ id }, visibleWhere(a)] },
        include: { category: { select: { name: true } }, _count: { select: { items: { where: { deletedAt: null } } } } },
      });
      if (!existing) return fail(reply, 404, "Resource not found");
      if (!canDelete(a, existing)) return fail(reply, 403, "Insufficient permissions");
      const now = new Date();
      await prisma.$transaction([
        prisma.resourceItem.updateMany({ where: { resourceId: id, deletedAt: null }, data: { deletedAt: now } }),
        prisma.resource.update({ where: { id }, data: { deletedAt: now } }),
      ]);
      if (!isOwner(a, existing)) {
        await recordAudit({
          request, action: "DELETE", entity: "Resource", entityId: id,
          summary: `Resource "${existing.title}" (${existing.category.name}, ${existing._count.items} item(s))`,
          oldValues: existing,
        });
      }
      if (existing.driveFolderId) {
        driveBestEffort(request, "trash resource folder", () => trashFile(existing.driveFolderId!));
      }
      return reply.send({ success: true, data: null });
    });

    // ── Items ──────────────────────────────────────────────────────────────────

    /** Resolves and checks the target folder of a new item. */
    async function resolveParent(resourceId: string, parentId: unknown): Promise<string | null | false> {
      if (parentId == null || parentId === "") return null;
      if (typeof parentId !== "string") return false;
      const p = await prisma.resourceItem.findFirst({
        where: { id: parentId, resourceId, kind: "FOLDER", deletedAt: null },
      });
      return p ? p.id : false;
    }

    async function manageableResource(request: FastifyRequest, reply: FastifyReply) {
      const a = access(request);
      const { id } = request.params as { id: string };
      const r = await findVisibleResource(a, id);
      if (!r) { fail(reply, 404, "Resource not found"); return null; }
      if (!canManage(a, r)) { fail(reply, 403, "Insufficient permissions"); return null; }
      return r;
    }

    app.post("/:id/folders", BULK, async (request, reply) => {
      const r = await manageableResource(request, reply);
      if (!r) return reply;
      const parsed = z.object({ name: nameSchema, parentId: z.string().nullish() }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const parentId = await resolveParent(r.id, parsed.data.parentId);
      if (parentId === false) return fail(reply, 400, "Folder not found");

      // Folder uploads send the same path many times; reuse the folder if it exists.
      const existing = await prisma.resourceItem.findFirst({
        where: { resourceId: r.id, parentId, kind: "FOLDER", deletedAt: null, name: parsed.data.name },
      });
      if (existing) return reply.send({ success: true, data: serializeItem(existing) });

      const data = await prisma.resourceItem.create({
        data: {
          resourceId: r.id, parentId, kind: "FOLDER", name: parsed.data.name,
          createdById: access(request).userId,
        },
      });
      await prisma.resource.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
      return reply.status(201).send({ success: true, data: serializeItem(data) });
    });

    app.post("/:id/links", async (request, reply) => {
      const r = await manageableResource(request, reply);
      if (!r) return reply;
      const parsed = z.object({
        name: nameSchema,
        url: z.string().trim().url("Enter a full link, starting with https://")
          .refine((u) => /^https?:\/\//i.test(u), "Only http and https links are allowed"),
        parentId: z.string().nullish(),
      }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const parentId = await resolveParent(r.id, parsed.data.parentId);
      if (parentId === false) return fail(reply, 400, "Folder not found");
      const data = await prisma.resourceItem.create({
        data: {
          resourceId: r.id, parentId, kind: "LINK", name: parsed.data.name, url: parsed.data.url,
          createdById: access(request).userId,
        },
      });
      await prisma.resource.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
      return reply.status(201).send({ success: true, data: serializeItem(data) });
    });

    // Step 1 of an upload: reserve the item and open a Drive upload session the
    // browser sends the bytes to directly. Step 2 is /items/:itemId/complete.
    app.post("/:id/uploads", BULK, async (request, reply) => {
      if (!isDriveConfigured()) return fail(reply, 503, "File uploads are not set up yet: Google Drive is not configured on this server");
      const r = await manageableResource(request, reply);
      if (!r) return reply;
      const parsed = z.object({
        name: nameSchema,
        mimeType: z.string().max(200).optional(),
        size: z.number().int().positive("The file is empty"),
        parentId: z.string().nullish(),
      }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const d = parsed.data;
      if (d.size > MAX_UPLOAD_BYTES) {
        return fail(reply, 413, `"${d.name}" is too large. The maximum file size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
      }
      const parentId = await resolveParent(r.id, d.parentId);
      if (parentId === false) return fail(reply, 400, "Folder not found");

      const mimeType = d.mimeType || "application/octet-stream";
      const item = await prisma.resourceItem.create({
        data: {
          resourceId: r.id, parentId, kind: "FILE", status: "UPLOADING", name: d.name,
          mimeType, sizeBytes: BigInt(d.size), createdById: access(request).userId,
        },
      });
      try {
        const driveParent = await ensureItemFolder(parentId, r.id);
        const origin = typeof request.headers.origin === "string" && WEB_ORIGINS.includes(request.headers.origin)
          ? request.headers.origin
          : undefined;
        const uploadUrl = await createUploadSession({
          name: d.name, mimeType, size: d.size, parentId: driveParent, itemId: item.id, origin,
        });
        return reply.status(201).send({ success: true, data: { itemId: item.id, uploadUrl } });
      } catch (err) {
        await prisma.resourceItem.delete({ where: { id: item.id } }).catch(() => {});
        throw err;
      }
    });

    app.post("/items/:itemId/complete", BULK, async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const parsed = z.object({ driveFileId: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, "Validation failed");
      const item = await prisma.resourceItem.findFirst({
        where: { id: itemId, kind: "FILE", status: "UPLOADING", createdById: a.userId, deletedAt: null },
      });
      if (!item) return fail(reply, 404, "Upload not found");

      // The browser tells us the file id; Drive has to confirm it is the file this
      // session created, or anyone could attach an arbitrary Drive file.
      const file = await getFile(parsed.data.driveFileId);
      if (file.appProperties?.cadbItemId !== item.id || file.trashed) {
        return fail(reply, 400, "The uploaded file could not be verified");
      }
      const data = await prisma.resourceItem.update({
        where: { id: item.id },
        data: {
          status: "READY", driveFileId: file.id,
          mimeType: file.mimeType || item.mimeType,
          sizeBytes: file.size ? BigInt(file.size) : item.sizeBytes,
        },
      });
      await prisma.resource.update({ where: { id: item.resourceId }, data: { updatedAt: new Date() } });
      return reply.send({ success: true, data: serializeItem(data) });
    });

    /** Abandons an upload the browser gave up on (cancelled or failed). */
    app.delete("/items/:itemId/upload", BULK, async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const item = await prisma.resourceItem.findFirst({
        where: { id: itemId, status: "UPLOADING", createdById: a.userId },
      });
      if (!item) return reply.send({ success: true, data: null });
      await prisma.resourceItem.delete({ where: { id: item.id } });
      driveBestEffort(request, "clean up abandoned upload", async () => {
        for (const f of await findByItemId(item.id)) await trashFile(f.id);
      });
      return reply.send({ success: true, data: null });
    });

    app.patch("/items/:itemId", async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const found = await findVisibleItem(a, itemId);
      if (!found) return fail(reply, 404, "Item not found");
      if (!canManage(a, found.resource)) return fail(reply, 403, "Insufficient permissions");
      const parsed = z.object({
        name: nameSchema.optional(),
        url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u)).optional(),
        parentId: z.string().nullable().optional(),
      }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, firstIssue(parsed.error));
      const d = parsed.data;

      let parentId: string | null | undefined;
      if (d.parentId !== undefined) {
        const resolved = await resolveParent(found.resource.id, d.parentId);
        if (resolved === false) return fail(reply, 400, "Folder not found");
        // A folder can't be moved into itself or anything inside it.
        if (resolved && (resolved === itemId
          || (await descendantIds(found.resource.id, [itemId])).includes(resolved))) {
          return fail(reply, 400, "A folder can't be moved inside itself");
        }
        parentId = resolved;
      }

      const data = await prisma.resourceItem.update({
        where: { id: itemId },
        data: {
          ...(d.name !== undefined && { name: d.name }),
          ...(d.url !== undefined && found.item.kind === "LINK" && { url: d.url }),
          ...(parentId !== undefined && { parentId }),
        },
      });
      const driveId = found.item.driveFileId;
      if (driveId) {
        if (d.name !== undefined && d.name !== found.item.name) {
          driveBestEffort(request, "rename item", () => renameFile(driveId, d.name!));
        }
        if (parentId !== undefined && parentId !== found.item.parentId) {
          driveBestEffort(request, "move item", async () =>
            moveFile(driveId, await ensureItemFolder(parentId!, found.resource.id)));
        }
      }
      return reply.send({ success: true, data: serializeItem(data) });
    });

    app.post("/items/:itemId/hide", async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const found = await findVisibleItem(a, itemId);
      if (!found) return fail(reply, 404, "Item not found");
      if (!canHide(a, found.resource)) return fail(reply, 403, "Insufficient permissions");
      const parsed = z.object({ hidden: z.boolean() }).safeParse(request.body);
      if (!parsed.success) return fail(reply, 400, "Validation failed");
      const data = await prisma.resourceItem.update({
        where: { id: itemId }, data: { isHidden: parsed.data.hidden },
      });
      return reply.send({ success: true, data: serializeItem(data) });
    });

    app.delete("/items/:itemId", async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const found = await findVisibleItem(a, itemId);
      if (!found) return fail(reply, 404, "Item not found");
      if (!canDelete(a, found.resource)) return fail(reply, 403, "Insufficient permissions");
      const ids = [itemId, ...await descendantIds(found.resource.id, [itemId])];
      await prisma.resourceItem.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
      if (!isOwner(a, found.resource)) {
        await recordAudit({
          request, action: "DELETE", entity: "ResourceItem", entityId: itemId,
          summary: `${found.item.kind === "FOLDER" ? "Folder" : found.item.kind === "LINK" ? "Link" : "File"} "${found.item.name}" in resource "${found.resource.title}"`,
          oldValues: { ...found.item, sizeBytes: found.item.sizeBytes?.toString() ?? null, descendants: ids.length - 1 },
        });
      }
      // Trashing a Drive folder trashes everything in it.
      if (found.item.driveFileId) {
        driveBestEffort(request, "trash item", () => trashFile(found.item.driveFileId!));
      }
      return reply.send({ success: true, data: null });
    });

    /** A short-lived URL the browser can put straight into <video>/<img>/<iframe>. */
    app.get("/items/:itemId/access", async (request, reply) => {
      const a = access(request);
      const { itemId } = request.params as { itemId: string };
      const found = await findVisibleItem(a, itemId);
      if (!found || found.item.kind !== "FILE" || found.item.status !== "READY") {
        return fail(reply, 404, "File not found");
      }
      const token = signStreamToken(itemId, request.user as JwtPayload);
      return reply.send({ success: true, data: { path: `/api/v1/resources/stream/${token}` } });
    });
  });
}

/**
 * Removes uploads the browser never finished (tab closed mid-upload). Their Drive
 * file, if Google ever created one, is found by the item id tagged onto it.
 */
export async function cleanupAbandonedUploads(): Promise<number> {
  if (!isDriveConfigured()) return 0;
  const stale = await prisma.resourceItem.findMany({
    where: { status: "UPLOADING", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true },
    take: 200,
  });
  for (const item of stale) {
    try {
      for (const f of await findByItemId(item.id)) await trashFile(f.id);
      await prisma.resourceItem.delete({ where: { id: item.id } });
    } catch (err) {
      if (!(err instanceof DriveError)) throw err;
    }
  }
  return stale.length;
}
