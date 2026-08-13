import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../utils/permissions.js";

const upsertSchema = z.object({
  title: z.string().min(1),
  grade: z.string().optional().nullable(),
});

export async function designationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (_request, reply) => {
    const data = await prisma.designation.findMany({
      orderBy: { title: "asc" },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/", { preHandler: requirePermission("ADM_DESIGNATIONS", "canCreate") }, async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    try {
      const data = await prisma.designation.create({ data: parsed.data });
      return reply.status(201).send({ success: true, data });
    } catch (e: any) {
      if (e.code === "P2002") return reply.status(409).send({ success: false, error: "Title already exists", statusCode: 409 });
      throw e;
    }
  });

  fastify.patch("/:id", { preHandler: requirePermission("ADM_DESIGNATIONS", "canEdit") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = upsertSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    try {
      const data = await prisma.designation.update({ where: { id }, data: parsed.data });
      return reply.send({ success: true, data });
    } catch (e: any) {
      if (e.code === "P2025") return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
      if (e.code === "P2002") return reply.status(409).send({ success: false, error: "Title already exists", statusCode: 409 });
      throw e;
    }
  });

  fastify.delete("/:id", { preHandler: requirePermission("ADM_DESIGNATIONS", "canDelete") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const count = await prisma.employee.count({ where: { designationId: id, deletedAt: null } });
    if (count > 0) {
      return reply.status(409).send({ success: false, error: `Cannot delete: ${count} active employee(s) have this designation`, statusCode: 409 });
    }
    try {
      await prisma.designation.delete({ where: { id } });
      return reply.send({ success: true, data: null });
    } catch (e: any) {
      if (e.code === "P2025") return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
      throw e;
    }
  });
}
