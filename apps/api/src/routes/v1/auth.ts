import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { verifyPassword, hashPassword } from "../../utils/password.js";
import type { JwtPayload } from "@cadb/types";

const loginSchema = z.object({
  employeeCode: z.string().min(1),
  password: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid input", statusCode: 400 });
    }

    const { employeeCode, password } = parsed.data;
    const employee = await prisma.employee.findUnique({
      where: { employeeCode },
      select: {
        id: true, employeeCode: true, passwordHash: true, firstName: true,
        lastName: true, email: true, photoUrl: true, departmentId: true,
        status: true, deletedAt: true, mustChangePassword: true, role: true,
        deptMemberships: { select: { departmentId: true, isHead: true } },
      },
    });

    if (!employee || employee.deletedAt) {
      return reply.status(401).send({ success: false, error: "Invalid credentials", statusCode: 401 });
    }
    if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
      return reply.status(403).send({ success: false, error: "Account deactivated", statusCode: 403 });
    }

    const valid = await verifyPassword(password, employee.passwordHash);
    if (!valid) {
      return reply.status(401).send({ success: false, error: "Invalid credentials", statusCode: 401 });
    }

    const role = employee.role as JwtPayload["role"];
    const payload: JwtPayload = {
      sub: employee.id,
      employeeCode: employee.employeeCode,
      role,
      departmentId: employee.departmentId,
      managedDeptIds: employee.deptMemberships.filter((m) => m.isHead).map((m) => m.departmentId),
      memberDeptIds: [employee.departmentId, ...employee.deptMemberships.map((m) => m.departmentId)],
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = fastify.jwt.sign({ sub: employee.id }, { expiresIn: "7d" });

    await prisma.session.create({
      data: {
        employeeId: employee.id,
        refreshToken,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: employee.mustChangePassword,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role,
          photoUrl: employee.photoUrl,
        },
      },
    });
  });

  fastify.post("/refresh", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (!body?.refreshToken) {
      return reply.status(400).send({ success: false, error: "Refresh token required", statusCode: 400 });
    }

    let payload: { sub: string };
    try {
      payload = fastify.jwt.verify<{ sub: string }>(body.refreshToken);
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid token", statusCode: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken: body.refreshToken },
    });
    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ success: false, error: "Session expired", statusCode: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        email: true, photoUrl: true, departmentId: true, role: true,
        deptMemberships: { select: { departmentId: true, isHead: true } },
      },
    });
    if (!employee) {
      return reply.status(401).send({ success: false, error: "User not found", statusCode: 401 });
    }

    const role = employee.role as JwtPayload["role"];
    const accessToken = fastify.jwt.sign(
      {
        sub: employee.id,
        employeeCode: employee.employeeCode,
        role,
        departmentId: employee.departmentId,
        managedDeptIds: employee.deptMemberships.filter((m) => m.isHead).map((m) => m.departmentId),
        memberDeptIds: [employee.departmentId, ...employee.deptMemberships.map((m) => m.departmentId)],
      },
      { expiresIn: "15m" }
    );

    return reply.send({
      success: true,
      data: {
        accessToken,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role,
          photoUrl: employee.photoUrl,
        },
      },
    });
  });

  fastify.post("/logout", async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (body?.refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken: body.refreshToken } });
    }
    return reply.send({ success: true, data: null, message: "Logged out" });
  });

  // Seed: create initial super admin (dev only)
  fastify.post("/seed-admin", async (request, reply) => {
    if (process.env.NODE_ENV !== "development") {
      return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
    }
    const body = request.body as { password?: string };
    const password = body?.password ?? "Admin@1234";

    let dept = await prisma.department.findUnique({ where: { code: "ADMIN" } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name: "Administration", code: "ADMIN" } });
    }
    let designation = await prisma.designation.findUnique({ where: { title: "Super Administrator" } });
    if (!designation) {
      designation = await prisma.designation.create({ data: { title: "Super Administrator", grade: "L1" } });
    }

    const existing = await prisma.employee.findUnique({ where: { employeeCode: "SA0001" } });
    if (existing) {
      return reply.send({ success: true, data: { message: "Admin already exists", employeeCode: "SA0001" } });
    }

    const admin = await prisma.employee.create({
      data: {
        employeeCode: "SA0001",
        email: "admin@centumacademy.com",
        passwordHash: await hashPassword(password),
        firstName: "System",
        lastName: "Administrator",
        gender: "MALE",
        dateOfBirth: new Date("1990-01-01"),
        personalPhone: "9000000000",
        currentAddress: { line1: "HQ", city: "Chennai", state: "Tamil Nadu", pincode: "600001", country: "India" },
        emergencyContactName: "N/A",
        emergencyContactPhone: "9000000000",
        emergencyRelation: "Self",
        departmentId: dept.id,
        designationId: designation.id,
        status: "ACTIVE",
        joiningDate: new Date(),
        mustChangePassword: false,
      },
    });

    return reply.status(201).send({
      success: true,
      data: { message: "Admin created", employeeCode: admin.employeeCode, password },
    });
  });

  // Change own password (authenticated)
  fastify.post("/change-password", async (request, reply) => {
    try { await request.jwtVerify(); } catch {
      return reply.status(401).send({ success: false, error: "Unauthorized", statusCode: 401 });
    }
    const user = request.user as JwtPayload;
    const body = request.body as { currentPassword?: string; newPassword?: string };

    if (!body.currentPassword || !body.newPassword) {
      return reply.status(400).send({ success: false, error: "currentPassword and newPassword required", statusCode: 400 });
    }
    if (body.newPassword.length < 8) {
      return reply.status(400).send({ success: false, error: "Password must be at least 8 characters", statusCode: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { id: true, passwordHash: true },
    });
    if (!employee) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    const valid = await verifyPassword(body.currentPassword, employee.passwordHash);
    if (!valid) return reply.status(400).send({ success: false, error: "Current password is incorrect", statusCode: 400 });

    await prisma.employee.update({
      where: { id: user.sub },
      data: { passwordHash: await hashPassword(body.newPassword), mustChangePassword: false },
    });
    // Invalidate all sessions so they must re-login with new password
    await prisma.session.deleteMany({ where: { employeeId: user.sub } });

    return reply.send({ success: true, data: null, message: "Password changed successfully. Please log in again." });
  });

  // Admin reset password for any employee
  fastify.post("/reset-password/:employeeId", async (request, reply) => {
    try { await request.jwtVerify(); } catch {
      return reply.status(401).send({ success: false, error: "Unauthorized", statusCode: 401 });
    }
    const actor = request.user as JwtPayload;
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "HR_ADMIN") {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const { employeeId } = request.params as { employeeId: string };
    const body = request.body as { newPassword?: string };

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
    if (!employee) return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });

    const newPassword = body?.newPassword ?? `Centum@${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true },
    });
    await prisma.session.deleteMany({ where: { employeeId } });

    await prisma.auditLog.create({
      data: { employeeId: actor.sub, action: "RESET_PASSWORD", entity: "Employee", entityId: employeeId },
    });

    return reply.send({
      success: true,
      data: { temporaryPassword: newPassword },
      message: "Password reset. Employee must change password on next login.",
    });
  });
}
