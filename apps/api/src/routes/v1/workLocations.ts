import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../utils/permissions.js";

const DEFAULT_LOCATIONS = ["Bangalore", "Pune", "Mumbai", "Remote"];

export async function workLocationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (_request, reply) => {
    let locations = await prisma.workLocation.findMany({ orderBy: { name: "asc" } });

    if (locations.length === 0) {
      await prisma.workLocation.createMany({
        data: DEFAULT_LOCATIONS.map((name) => ({ name })),
        skipDuplicates: true,
      });
      locations = await prisma.workLocation.findMany({ orderBy: { name: "asc" } });
    }

    return reply.send({ success: true, data: locations });
  });

  fastify.post("/", { preHandler: requirePermission("ADM_WORK_LOCATIONS", "canCreate") }, async (request, reply) => {
    const schema = z.object({ name: z.string().min(1).max(60) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Name is required", statusCode: 400 });
    }
    try {
      const data = await prisma.workLocation.create({ data: { name: parsed.data.name.trim() } });
      return reply.status(201).send({ success: true, data });
    } catch {
      return reply.status(409).send({ success: false, error: "Location already exists", statusCode: 409 });
    }
  });

  fastify.delete("/:id", { preHandler: requirePermission("ADM_WORK_LOCATIONS", "canDelete") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const loc = await prisma.workLocation.findUnique({ where: { id } });
    if (!loc) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
    await prisma.workLocation.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
