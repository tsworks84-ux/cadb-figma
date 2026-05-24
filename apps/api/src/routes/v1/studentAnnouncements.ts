import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import type { StudentJwtPayload } from "@cadb/types";

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

export async function studentAnnouncementRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: (req, rep) => authenticateStudent(fastify, req, rep) }, async (request, reply) => {
    const announcements = await prisma.announcement.findMany({
      where: { status: "PUBLISHED", audience: "STUDENTS" },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      select: {
        id: true, title: true, body: true, type: true, pinned: true,
        publishedAt: true, expiresAt: true, attachments: true,
        postedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return reply.send({ success: true, data: announcements });
  });
}
