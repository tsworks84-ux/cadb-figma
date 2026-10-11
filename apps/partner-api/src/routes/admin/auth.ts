import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { partnerDb } from "../../db.js";
import { config } from "../../config.js";
import { hashPassword, hashToken, newToken, PASSWORD_MIN, requireAdmin, verifyPassword } from "../../lib/auth.js";
import { recordAdminAudit } from "../../lib/audit.js";

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`).max(200),
});

// A real bcrypt hash of a random string, so unknown emails take as long to
// reject as wrong passwords and can't be told apart by timing.
const DUMMY_HASH = hashPassword(newToken());

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { email, password } = loginBody.parse(request.body);
      const user = await partnerDb.adminUser.findUnique({ where: { email } });
      const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
      if (!user || !ok || !user.isActive) {
        return reply.status(401).send({ error: "That email and password don't match an active account." });
      }

      const token = newToken();
      await partnerDb.$transaction([
        partnerDb.adminSession.create({
          data: {
            adminUserId: user.id,
            tokenHash: hashToken(token),
            ip: request.ip,
            userAgent: request.headers["user-agent"]?.slice(0, 300),
            expiresAt: new Date(Date.now() + config.adminSessionHours * 3600_000),
          },
        }),
        partnerDb.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      ]);

      return {
        token,
        expiresInSeconds: config.adminSessionHours * 3600,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
      };
    },
  );

  app.get("/auth/me", { preHandler: requireAdmin }, async (request) => {
    const a = request.admin!;
    return { id: a.id, email: a.email, name: a.name, role: a.role, mustChangePassword: a.mustChangePassword };
  });

  app.post("/auth/logout", { preHandler: requireAdmin }, async (request) => {
    await partnerDb.adminSession.update({ where: { id: request.admin!.sessionId }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  app.post("/auth/change-password", { preHandler: requireAdmin }, async (request, reply) => {
    const { currentPassword, newPassword } = changePasswordBody.parse(request.body);
    const admin = request.admin!;
    const user = await partnerDb.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return reply.status(400).send({ error: "Your current password is not correct." });
    }
    if (currentPassword === newPassword) {
      return reply.status(400).send({ error: "Choose a password different from your current one." });
    }

    await partnerDb.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
      });
      // Sign out every other session; this one stays.
      await tx.adminSession.updateMany({
        where: { adminUserId: admin.id, revokedAt: null, id: { not: admin.sessionId } },
        data: { revokedAt: new Date() },
      });
      await recordAdminAudit(admin.id, "admin.password.change", "AdminUser", admin.id, {}, tx);
    });
    return { ok: true };
  });
}
