import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

const upsertSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).toUpperCase(),
  headId: z.string().cuid().optional().nullable(),
});

export async function departmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (_request, reply) => {
    const data = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    try {
      const data = await prisma.department.create({ data: parsed.data });
      return reply.status(201).send({ success: true, data });
    } catch (e: any) {
      if (e.code === "P2002") return reply.status(409).send({ success: false, error: "Name or code already exists", statusCode: 409 });
      throw e;
    }
  });

  fastify.patch("/:id", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = upsertSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    try {
      const data = await prisma.department.update({ where: { id }, data: parsed.data });
      return reply.send({ success: true, data });
    } catch (e: any) {
      if (e.code === "P2025") return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
      if (e.code === "P2002") return reply.status(409).send({ success: false, error: "Name or code already exists", statusCode: 409 });
      throw e;
    }
  });

  fastify.delete("/:id", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const count = await prisma.employee.count({ where: { departmentId: id, deletedAt: null } });
    if (count > 0) {
      return reply.status(409).send({ success: false, error: `Cannot delete: ${count} active employee(s) assigned to this department`, statusCode: 409 });
    }
    try {
      await prisma.department.delete({ where: { id } });
      return reply.send({ success: true, data: null });
    } catch (e: any) {
      if (e.code === "P2025") return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
      throw e;
    }
  });
}
