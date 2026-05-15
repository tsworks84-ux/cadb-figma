import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { verifyPassword, hashPassword } from "../../utils/password.js";
import type { StudentJwtPayload } from "@cadb/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

async function authenticateStudent(fastify: FastifyInstance, request: any, reply: any) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ success: false, error: "Unauthorized" });
  try {
    const payload = fastify.jwt.verify<StudentJwtPayload>(auth.slice(7));
    if (payload.userType !== "STUDENT") throw new Error("Not a student token");
    (request as any).student = payload;
  } catch {
    return reply.status(401).send({ success: false, error: "Invalid or expired token" });
  }
}

export async function studentAuthRoutes(fastify: FastifyInstance) {
  fastify.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Invalid input" });

    const { email, password } = parsed.data;
    const student = await prisma.student.findUnique({
      where: { email },
      select: {
        id: true, studentCode: true, passwordHash: true,
        firstName: true, lastName: true, email: true,
        photoUrl: true, batchId: true, mustChangePassword: true,
        status: true, isArchived: true,
      },
    });

    if (!student || student.isArchived) {
      return reply.status(401).send({ success: false, error: "Invalid credentials" });
    }
    if (student.status === "INACTIVE" || student.status === "DROPPED") {
      return reply.status(403).send({ success: false, error: "Account is inactive" });
    }

    const valid = await verifyPassword(password, student.passwordHash);
    if (!valid) return reply.status(401).send({ success: false, error: "Invalid credentials" });

    const payload: StudentJwtPayload = {
      sub: student.id,
      studentCode: student.studentCode,
      userType: "STUDENT",
    };

    const accessToken  = fastify.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = fastify.jwt.sign({ sub: student.id, userType: "STUDENT" }, { expiresIn: "7d" });

    await prisma.studentSession.create({
      data: {
        studentId: student.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: student.mustChangePassword,
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          photoUrl: student.photoUrl,
          batchId: student.batchId,
        },
      },
    });
  });

  fastify.post("/refresh", async (request, reply) => {
    const { refreshToken } = (request.body as any) ?? {};
    if (!refreshToken) return reply.status(400).send({ success: false, error: "Refresh token required" });

    let payload: any;
    try {
      payload = fastify.jwt.verify(refreshToken);
      if (payload.userType !== "STUDENT") throw new Error();
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid refresh token" });
    }

    const session = await prisma.studentSession.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ success: false, error: "Session expired" });
    }

    const student = await prisma.student.findUnique({
      where: { id: payload.sub },
      select: { id: true, studentCode: true, isArchived: true, status: true },
    });
    if (!student || student.isArchived) {
      return reply.status(401).send({ success: false, error: "Account not found" });
    }

    const newPayload: StudentJwtPayload = { sub: student.id, studentCode: student.studentCode, userType: "STUDENT" };
    const accessToken = fastify.jwt.sign(newPayload, { expiresIn: "15m" });

    return reply.send({ success: true, data: { accessToken } });
  });

  fastify.post("/logout", async (request, reply) => {
    const { refreshToken } = (request.body as any) ?? {};
    if (refreshToken) {
      await prisma.studentSession.deleteMany({ where: { refreshToken } }).catch(() => {});
    }
    return reply.send({ success: true });
  });

  fastify.post("/change-password", { preHandler: (req, rep) => authenticateStudent(fastify, req, rep) }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const studentId = (request as any).student.sub;
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { passwordHash: true, initialPasswordHash: true } });
    if (!student) return reply.status(404).send({ success: false, error: "Not found" });

    const valid = await verifyPassword(parsed.data.currentPassword, student.passwordHash);
    if (!valid) return reply.status(400).send({ success: false, error: "Current password is incorrect" });

    if (student.initialPasswordHash) {
      const isSameAsInitial = await verifyPassword(parsed.data.newPassword, student.initialPasswordHash);
      if (isSameAsInitial) {
        return reply.status(400).send({ success: false, error: "New password cannot be the same as your default password" });
      }
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false },
    });

    return reply.send({ success: true });
  });
}
