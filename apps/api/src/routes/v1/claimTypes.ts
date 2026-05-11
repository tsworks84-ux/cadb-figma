import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";

export async function claimTypeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Get all active claim types (all authenticated users)
  fastify.get("/", async (_request, reply) => {
    const data = await prisma.claimTypeConfig.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
    });
    return reply.send({ success: true, data });
  });

  // Get all claim types including inactive (admin only)
  fastify.get("/all", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (_request, reply) => {
    const data = await prisma.claimTypeConfig.findMany({ orderBy: { label: "asc" } });
    return reply.send({ success: true, data });
  });

  // Create a new claim type (SUPER_ADMIN only)
  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const body = request.body as { label?: string; requiresDocument?: boolean; isSettleable?: boolean };
    if (!body.label?.trim()) {
      return reply.status(400).send({ success: false, error: "label is required", statusCode: 400 });
    }
    const name = body.label.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    const existing = await prisma.claimTypeConfig.findUnique({ where: { name } });
    if (existing) {
      return reply.status(409).send({ success: false, error: "A claim type with this name already exists", statusCode: 409 });
    }
    const data = await prisma.claimTypeConfig.create({
      data: {
        name,
        label: body.label.trim(),
        requiresDocument: body.requiresDocument ?? false,
        isSettleable: body.isSettleable ?? true,
      },
    });
    return reply.status(201).send({ success: true, data });
  });

  // Update a claim type (SUPER_ADMIN only)
  fastify.patch("/:id", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { label?: string; requiresDocument?: boolean; isSettleable?: boolean; isActive?: boolean };
    const data = await prisma.claimTypeConfig.update({
      where: { id },
      data: {
        ...(body.label !== undefined && { label: body.label.trim() }),
        ...(body.requiresDocument !== undefined && { requiresDocument: body.requiresDocument }),
        ...(body.isSettleable !== undefined && { isSettleable: body.isSettleable }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return reply.send({ success: true, data });
  });

  // Delete a claim type (SUPER_ADMIN only) — only if no claims use it
  fastify.delete("/:id", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ct = await prisma.claimTypeConfig.findUnique({ where: { id } });
    if (!ct) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    const usageCount = await prisma.reimbursementClaim.count({ where: { claimType: ct.name } });
    if (usageCount > 0) {
      return reply.status(409).send({
        success: false,
        error: `Cannot delete — ${usageCount} claim(s) use this type. Deactivate it instead.`,
        statusCode: 409,
      });
    }
    await prisma.claimTypeConfig.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
