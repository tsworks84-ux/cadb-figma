import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import { prisma } from "@cadb/db";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { authRoutes } from "./routes/v1/auth.js";
import { employeeRoutes } from "./routes/v1/employees.js";
import { leaveRoutes } from "./routes/v1/leaves.js";
import { claimRoutes } from "./routes/v1/claims.js";
import { auditLogRoutes } from "./routes/v1/auditLogs.js";
import { claimTypeRoutes } from "./routes/v1/claimTypes.js";
import { policyRoutes } from "./routes/v1/policies.js";
import { trainingRoutes } from "./routes/v1/training.js";
import { departmentRoutes } from "./routes/v1/departments.js";
import { designationRoutes } from "./routes/v1/designations.js";
import { documentRoutes } from "./routes/v1/documents.js";
import { bankDetailRoutes } from "./routes/v1/bankDetails.js";
import { roleRoutes } from "./routes/v1/roles.js";
import { bonusRoutes } from "./routes/v1/bonus.js";
import { leavePolicyRoutes } from "./routes/v1/leavePolicies.js";
import { holidayRoutes } from "./routes/v1/holidays.js";
import { teamRoutes } from "./routes/v1/team.js";
import { taskRoutes } from "./routes/v1/tasks.js";
import { todoRoutes } from "./routes/v1/todos.js";
import { googleCalendarRoutes } from "./routes/v1/googleCalendar.js";
import { announcementRoutes } from "./routes/v1/announcements.js";
import { reportRoutes } from "./routes/v1/reports.js";
import { workLocationRoutes } from "./routes/v1/workLocations.js";
import { directoryRoutes } from "./routes/v1/directory.js";
import { timesheetRoutes } from "./routes/v1/timesheet.js";
import { studentAuthRoutes } from "./routes/v1/student-auth.js";
import { studentAnnouncementRoutes } from "./routes/v1/studentAnnouncements.js";
import { studentPortalRoutes } from "./routes/v1/studentPortal.js";
import { academicsRoutes } from "./routes/v1/academics.js";
import { academicSettingsRoutes } from "./routes/v1/academicSettings.js";
import { studentRoutes } from "./routes/v1/students.js";
import { scheduleRoutes } from "./routes/v1/schedule.js";
import { assignmentRoutes } from "./routes/v1/assignments.js";
import { assessmentRoutes } from "./routes/v1/assessments.js";
import { academicReportsRoutes } from "./routes/v1/academicReports.js";
import { adminFeedbackRoutes } from "./routes/v1/adminFeedback.js";
import { revenueRoutes } from "./routes/v1/revenue.js";
import { confirmExpiredProbations } from "./utils/probation.js";
import { createReadStream, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

await server.register(cors, {
  origin: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://cadb.centumacademy.com",
    "http://65.0.41.55:3002",
  ],
  credentials: true,
});

await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await server.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

await server.register(jwt, {
  secret: process.env.JWT_SECRET!,
  sign: { expiresIn: "15m" },
});

await server.register(swagger, {
  openapi: {
    info: { title: "CADB API", version: "1.0.0", description: "Centum Academy Dashboard API" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
});

await server.register(swaggerUi, { routePrefix: "/docs" });

// Health check
server.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// v1 routes
await server.register(authRoutes, { prefix: "/api/v1/auth" });
await server.register(employeeRoutes, { prefix: "/api/v1/employees" });
await server.register(leaveRoutes, { prefix: "/api/v1/leaves" });
await server.register(claimRoutes, { prefix: "/api/v1/claims" });
await server.register(claimTypeRoutes, { prefix: "/api/v1/claim-types" });
await server.register(auditLogRoutes, { prefix: "/api/v1/audit-logs" });
await server.register(policyRoutes, { prefix: "/api/v1/policies" });
await server.register(trainingRoutes, { prefix: "/api/v1/training" });
await server.register(departmentRoutes, { prefix: "/api/v1/departments" });
await server.register(designationRoutes, { prefix: "/api/v1/designations" });
await server.register(documentRoutes, { prefix: "/api/v1/employees" });
await server.register(bankDetailRoutes, { prefix: "/api/v1/employees" });
await server.register(roleRoutes, { prefix: "/api/v1/roles" });
await server.register(bonusRoutes, { prefix: "/api/v1" });
await server.register(leavePolicyRoutes, { prefix: "/api/v1/leave-policies" });
await server.register(holidayRoutes, { prefix: "/api/v1/holidays" });
await server.register(teamRoutes, { prefix: "/api/v1/employees" });
await server.register(taskRoutes, { prefix: "/api/v1/tasks" });
await server.register(todoRoutes, { prefix: "/api/v1/todos" });
await server.register(googleCalendarRoutes, { prefix: "/api/v1/auth/google" });
await server.register(announcementRoutes, { prefix: "/api/v1/announcements" });
await server.register(reportRoutes, { prefix: "/api/v1/reports" });
await server.register(workLocationRoutes, { prefix: "/api/v1/work-locations" });
await server.register(directoryRoutes,    { prefix: "/api/v1/directory" });
await server.register(timesheetRoutes,    { prefix: "/api/v1/timesheet" });
await server.register(studentAuthRoutes,           { prefix: "/api/v1/student/auth" });
await server.register(studentAnnouncementRoutes,  { prefix: "/api/v1/student/announcements" });
await server.register(studentPortalRoutes,        { prefix: "/api/v1/student/portal" });
await server.register(academicsRoutes,         { prefix: "/api/v1/academics" });
await server.register(academicSettingsRoutes,  { prefix: "/api/v1/academics" });
await server.register(studentRoutes,           { prefix: "/api/v1/academics/students" });
await server.register(scheduleRoutes,           { prefix: "/api/v1/academics/schedules" });
await server.register(assignmentRoutes,         { prefix: "/api/v1/academics/assignments" });
await server.register(assessmentRoutes,         { prefix: "/api/v1/academics/assessments" });
await server.register(academicReportsRoutes,    { prefix: "/api/v1/academics/reports" });
await server.register(adminFeedbackRoutes,      { prefix: "/api/v1/feedback" });
await server.register(revenueRoutes,            { prefix: "/api/v1/revenue" });
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

server.get("/uploads/*", async (request, reply) => {
  const filePath = (request.params as Record<string, string>)["*"];
  const fullPath = join(__dirname, "../uploads", filePath);
  if (!existsSync(fullPath)) {
    return reply.status(404).send({ success: false, error: "File not found" });
  }
  const mime = MIME[extname(fullPath).toLowerCase()] ?? "application/octet-stream";
  reply.header("Content-Type", mime);
  reply.header("Cache-Control", "public, max-age=31536000, immutable");
  return reply.send(createReadStream(fullPath));
});

// Global error handler
server.setErrorHandler((error: FastifyError, _request, reply) => {
  server.log.error(error);
  if (error.statusCode === 429) {
    return reply.status(429).send({ success: false, error: "Too many requests", statusCode: 429 });
  }
  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    success: false,
    error: statusCode === 500 ? "Internal server error" : error.message,
    statusCode,
  });
});

const port = parseInt(process.env.API_PORT ?? "4000");
try {
  // Establish DB connection before accepting traffic so the first request isn't slow
  await prisma.$connect();
  await server.listen({ port, host: "0.0.0.0" });
  console.log(`API running at http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);

  // Auto-confirm employees whose 3-month probation has elapsed — on startup, then daily.
  const runProbationCheck = async () => {
    try {
      const n = await confirmExpiredProbations();
      if (n > 0) console.log(`Probation check: confirmed ${n} employee(s) to ACTIVE`);
    } catch (err) {
      server.log.error({ err }, "Probation confirmation check failed");
    }
  };
  await runProbationCheck();
  setInterval(runProbationCheck, 24 * 60 * 60 * 1000).unref();
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
