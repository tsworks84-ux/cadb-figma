import { timingSafeEqual } from "crypto";
import Fastify, { type FastifyError } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { cadb, partnerDb } from "./db.js";
import { adminAuthRoutes } from "./routes/admin/auth.js";
import { adminLookupRoutes } from "./routes/admin/lookups.js";
import { adminBoardRoutes } from "./routes/admin/boards.js";
import { adminPartnerRoutes } from "./routes/admin/partners.js";
import { adminProjectRoutes } from "./routes/admin/projects.js";
import { adminBatchRoutes } from "./routes/admin/batches.js";
import { adminDataQualityRoutes } from "./routes/admin/dataQuality.js";
import { adminAuditRoutes } from "./routes/admin/audit.js";

// partner-api is never exposed to browsers. Only the partner-admin and
// partner-web servers call it, over localhost or a private network, and every
// request must carry the shared service secret.
const server = Fastify({
  logger: config.isDev ? { transport: { target: "pino-pretty", options: { colorize: true } } } : true,
  // The calling server forwards the browser's IP; trust that from localhost only.
  trustProxy: "127.0.0.1",
  bodyLimit: 1024 * 1024,
});

const secret = Buffer.from(config.serviceSecret);
server.addHook("onRequest", async (request, reply) => {
  if (request.url === "/health") return;
  const given = Buffer.from(String(request.headers["x-service-secret"] ?? ""));
  if (given.length !== secret.length || !timingSafeEqual(given, secret)) {
    return reply.status(403).send({ error: "Forbidden" });
  }
});

await server.register(rateLimit, { global: false });

server.setErrorHandler((error: FastifyError, request, reply) => {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const field = first?.path.join(".");
    return reply.status(400).send({ error: field ? `${field}: ${first.message}` : first?.message ?? "Invalid request.", issues: error.issues });
  }
  if (error.statusCode === 429) return reply.status(429).send({ error: "Too many attempts. Wait a minute and try again." });
  if (error.statusCode && error.statusCode < 500) return reply.status(error.statusCode).send({ error: error.message });
  request.log.error(error);
  // Never send internal details (table names, hosts) back to a caller.
  return reply.status(500).send({ error: "Something went wrong. Try again, and contact your administrator if it keeps happening." });
});

server.get("/health", async () => ({ ok: true }));

await server.register(
  async (admin) => {
    await admin.register(adminAuthRoutes);
    await admin.register(adminLookupRoutes);
    await admin.register(adminBoardRoutes);
    await admin.register(adminPartnerRoutes);
    await admin.register(adminProjectRoutes);
    await admin.register(adminBatchRoutes);
    await admin.register(adminDataQualityRoutes);
    await admin.register(adminAuditRoutes);
  },
  { prefix: "/admin/v1" },
);

const shutdown = async () => {
  await server.close();
  await Promise.all([partnerDb.$disconnect(), cadb.$disconnect()]);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await server.listen({ host: config.host, port: config.port });
