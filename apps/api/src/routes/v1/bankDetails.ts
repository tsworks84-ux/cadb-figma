import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";

const schema = z.object({
  accountName: z.string().min(1),
  accountNumber: z.string().min(9).max(18),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
  bankName: z.string().min(1),
  branchName: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export async function bankDetailRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/:employeeId/bank-details", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const data = await prisma.bankDetail.findMany({
      where: { employeeId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/:employeeId/bank-details", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId } = request.params as { employeeId: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors, statusCode: 400 });
    }

    // If marking as primary, unset others
    if (parsed.data.isPrimary) {
      await prisma.bankDetail.updateMany({ where: { employeeId }, data: { isPrimary: false } });
    }

    const data = await prisma.bankDetail.create({ data: { employeeId, ...parsed.data } });
    return reply.status(201).send({ success: true, data });
  });

  fastify.put("/:employeeId/bank-details/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId, id } = request.params as { employeeId: string; id: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors, statusCode: 400 });
    }

    const detail = await prisma.bankDetail.findFirst({ where: { id, employeeId } });
    if (!detail) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    if (parsed.data.isPrimary) {
      await prisma.bankDetail.updateMany({ where: { employeeId, id: { not: id } }, data: { isPrimary: false } });
    }

    const data = await prisma.bankDetail.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data });
  });

  fastify.delete("/:employeeId/bank-details/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { employeeId, id } = request.params as { employeeId: string; id: string };

    if (user.role === "EMPLOYEE" && user.sub !== employeeId) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const detail = await prisma.bankDetail.findFirst({ where: { id, employeeId } });
    if (!detail) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    await prisma.bankDetail.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
