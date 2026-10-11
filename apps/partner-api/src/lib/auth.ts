import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdminRole } from "@cadb/partner-db";
import { partnerDb } from "../db.js";

export interface AdminContext {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  mustChangePassword: boolean;
  sessionId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: AdminContext;
  }
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const PASSWORD_MIN = 10;

// Routes a user who must change their password may still reach.
const PASSWORD_CHANGE_ALLOWED = new Set(["/admin/v1/auth/me", "/admin/v1/auth/change-password", "/admin/v1/auth/logout"]);

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return reply.status(401).send({ error: "Sign in to continue." });

  const session = await partnerDb.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: true },
  });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || !session.adminUser.isActive) {
    return reply.status(401).send({ error: "Your session has ended. Sign in again." });
  }

  const user = session.adminUser;
  request.admin = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionId: session.id,
  };

  const path = request.routeOptions.url ?? request.url.split("?")[0];
  if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(path)) {
    return reply.status(403).send({ error: "Change your password before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
  }
}
