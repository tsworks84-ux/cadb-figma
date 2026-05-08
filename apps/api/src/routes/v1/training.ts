import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";

const createProgramSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  provider: z.string().optional(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).default("ONLINE"),
  durationHours: z.number().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  seats: z.number().int().positive().optional(),
  isMandatory: z.boolean().default(false),
});

export async function trainingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/programs", async (_request, reply) => {
    const data = await prisma.trainingProgram.findMany({
      orderBy: { startDate: "asc" },
      include: { _count: { select: { enrollments: true } } },
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/programs", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = createProgramSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const d = parsed.data;
    const data = await prisma.trainingProgram.create({
      data: {
        ...d,
        startDate: d.startDate ? new Date(d.startDate) : undefined,
        endDate: d.endDate ? new Date(d.endDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data });
  });

  fastify.post("/programs/:programId/enroll", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { programId } = request.params as { programId: string };
    const body = request.body as { employeeId?: string };

    const targetId = user.role !== "EMPLOYEE" && body.employeeId ? body.employeeId : user.sub;

    const program = await prisma.trainingProgram.findUnique({ where: { id: programId } });
    if (!program) {
      return reply.status(404).send({ success: false, error: "Program not found", statusCode: 404 });
    }

    const enrollment = await prisma.trainingEnrollment.upsert({
      where: { employeeId_programId: { employeeId: targetId, programId } },
      create: { employeeId: targetId, programId, status: "ENROLLED" },
      update: { status: "ENROLLED" },
    });
    return reply.status(201).send({ success: true, data: enrollment });
  });

  fastify.patch("/enrollments/:id/complete", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = request.body as { score?: number; feedback?: string };

    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { id, ...(user.role === "EMPLOYEE" && { employeeId: user.sub }) },
    });
    if (!enrollment) {
      return reply.status(404).send({ success: false, error: "Enrollment not found", statusCode: 404 });
    }

    const updated = await prisma.trainingEnrollment.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date(), score: body.score, feedback: body.feedback },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.get("/my-enrollments", async (request, reply) => {
    const user = request.user as JwtPayload;
    const data = await prisma.trainingEnrollment.findMany({
      where: { employeeId: user.sub },
      include: { program: true },
      orderBy: { enrolledAt: "desc" },
    });
    return reply.send({ success: true, data });
  });
}
