import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload, Role } from "@cadb/types";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ success: false, error: "Unauthorized", statusCode: 401 });
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }
  };
}
