import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";
import { recordAdminAudit } from "../../lib/audit.js";

const createBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "Use 2–16 letters, digits or dashes, e.g. CBSE."),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const updateBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export async function adminBoardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/boards", async () => {
    const boards = await partnerDb.board.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: { _count: { select: { schoolGrades: true } } },
    });
    return boards.map(({ _count, ...b }) => ({ ...b, usedBy: _count.schoolGrades }));
  });

  app.post("/boards", async (request, reply) => {
    const body = createBody.parse(request.body);
    if (await partnerDb.board.findUnique({ where: { code: body.code } })) {
      return reply.status(409).send({ error: `A board with code ${body.code} already exists.` });
    }
    const board = await partnerDb.$transaction(async (tx) => {
      const created = await tx.board.create({ data: { ...body, sortOrder: body.sortOrder ?? 100 } });
      await recordAdminAudit(request.admin!.id, "board.create", "Board", created.id, { after: created }, tx);
      return created;
    });
    return reply.status(201).send(board);
  });

  app.patch<{ Params: { id: string } }>("/boards/:id", async (request, reply) => {
    const body = updateBody.parse(request.body);
    const before = await partnerDb.board.findUnique({ where: { id: request.params.id } });
    if (!before) return reply.status(404).send({ error: "Board not found." });
    return partnerDb.$transaction(async (tx) => {
      const after = await tx.board.update({ where: { id: before.id }, data: body });
      await recordAdminAudit(request.admin!.id, "board.update", "Board", before.id, { before, after }, tx);
      return after;
    });
  });
}
