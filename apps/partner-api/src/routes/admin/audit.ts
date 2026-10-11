import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";

const listQuery = z.object({
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(4000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export async function adminAuditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/audit", async (request) => {
    const q = listQuery.parse(request.query);
    const where = { entityType: q.entityType, entityId: q.entityId };
    const [total, rows] = await Promise.all([
      partnerDb.adminAuditLog.count({ where }),
      partnerDb.adminAuditLog.findMany({
        where,
        orderBy: { at: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { adminUser: { select: { name: true, email: true } } },
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, rows };
  });
}
