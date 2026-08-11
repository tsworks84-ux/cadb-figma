import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

/**
 * Read-only view over the audit trail. Deliberately has no write or delete
 * endpoint — the log is append-only, and it is worthless as a record of
 * deletions if it can itself be edited.
 */
/**
 * Actions that destroy or void a record. The deletion log defaults to these —
 * the same table also carries routine CREATE/UPDATE noise from the employee
 * routes, which isn't what anyone opens this page to see.
 */
export const DESTRUCTIVE_ACTIONS = ["DELETE", "BULK_DELETE", "FORCE_CANCEL"];

export async function auditLogRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("SUPER_ADMIN", "HR_ADMIN"));

  fastify.get("/", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const take = Math.min(Math.max(parseInt(q.limit ?? "50", 10) || 50, 1), 200);
    const skip = Math.max(parseInt(q.offset ?? "0", 10) || 0, 0);

    const where: any = {};
    // `action` accepts a comma-separated list; `scope=all` opts out of the
    // destructive-only default and returns the full trail.
    if (q.action) {
      const actions = q.action.split(",").map((a) => a.trim()).filter(Boolean);
      where.action = actions.length > 1 ? { in: actions } : actions[0];
    } else if (q.scope !== "all") {
      where.action = { in: DESTRUCTIVE_ACTIONS };
    }
    if (q.entity) where.entity = q.entity;
    if (q.employeeId) where.employeeId = q.employeeId;
    if (q.search?.trim()) {
      where.summary = { contains: q.search.trim(), mode: "insensitive" };
    }

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
    ]);

    return reply.send({ success: true, data, meta: { total, limit: take, offset: skip } });
  });
}
