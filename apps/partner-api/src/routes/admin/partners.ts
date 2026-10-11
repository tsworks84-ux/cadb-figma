import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";
import { recordAdminAudit } from "../../lib/audit.js";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();

const fields = {
  name: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  isInternal: z.boolean(),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0B6E79.").nullable().optional()
    .or(z.literal("").transform(() => null)),
  logoUrl: optionalText(500),
  domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a bare domain like schoolinsights.in.").nullable().optional()
    .or(z.literal("").transform(() => null)),
  emailFrom: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal("").transform(() => null)),
};

const createBody = z.object({ ...fields, isInternal: fields.isInternal.default(false) });
const updateBody = z.object({ ...fields, isArchived: z.boolean() }).partial();

export async function adminPartnerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/partners", async () => {
    const partners = await partnerDb.partner.findMany({
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
      include: { _count: { select: { projects: true, users: true } } },
    });
    return partners.map(({ _count, ...p }) => ({ ...p, projectCount: _count.projects, userCount: _count.users }));
  });

  app.post("/partners", async (request, reply) => {
    const body = createBody.parse(request.body);
    const clash = await partnerDb.partner.findFirst({
      where: { OR: [{ name: body.name }, ...(body.domain ? [{ domain: body.domain }] : [])] },
    });
    if (clash) return reply.status(409).send({ error: "Another partner already uses that name or domain." });

    const partner = await partnerDb.$transaction(async (tx) => {
      const created = await tx.partner.create({ data: body });
      await recordAdminAudit(request.admin!.id, "partner.create", "Partner", created.id, { after: created }, tx);
      return created;
    });
    return reply.status(201).send(partner);
  });

  app.patch<{ Params: { id: string } }>("/partners/:id", async (request, reply) => {
    const body = updateBody.parse(request.body);
    const before = await partnerDb.partner.findUnique({ where: { id: request.params.id } });
    if (!before) return reply.status(404).send({ error: "Partner not found." });

    if (body.isArchived === true && !before.isArchived) {
      const active = await partnerDb.project.count({ where: { partnerId: before.id, status: "ACTIVE" } });
      if (active > 0) {
        return reply.status(409).send({ error: `Archive this partner's ${active} active project(s) first.` });
      }
    }
    if (body.name || body.domain) {
      const clash = await partnerDb.partner.findFirst({
        where: {
          id: { not: before.id },
          OR: [...(body.name ? [{ name: body.name }] : []), ...(body.domain ? [{ domain: body.domain }] : [])],
        },
      });
      if (clash) return reply.status(409).send({ error: "Another partner already uses that name or domain." });
    }

    return partnerDb.$transaction(async (tx) => {
      const after = await tx.partner.update({ where: { id: before.id }, data: body });
      await recordAdminAudit(request.admin!.id, "partner.update", "Partner", before.id, { before, after }, tx);
      return after;
    });
  });
}
