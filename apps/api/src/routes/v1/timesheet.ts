import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";

const entrySchema = z.object({
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  lectureHours: z.number().min(0).max(24).default(0),
  ptmHours:     z.number().min(0).max(24).default(0),
  otherHours:   z.number().min(0).max(24).default(0),
  otherReason:  z.string().max(500).optional(),
  answerScripts:z.number().int().min(0).default(0),
});

export async function timesheetRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // GET /api/v1/timesheet?month=YYYY-MM  — own entries for a month
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const q = request.query as Record<string, string>;
    const month = q.month ?? new Date().toISOString().slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return reply.status(400).send({ success: false, error: "month must be YYYY-MM", statusCode: 400 });
    }

    const [year, mo] = month.split("-").map(Number);
    const start = new Date(year, mo - 1, 1);
    const end   = new Date(year, mo, 0, 23, 59, 59, 999);

    const entries = await prisma.partTimeEntry.findMany({
      where: { employeeId: user.sub, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });

    return reply.send({ success: true, data: entries });
  });

  // GET /api/v1/timesheet/employee/:id?month=YYYY-MM  — admin view of any employee
  fastify.get(
    "/employee/:id",
    { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const q = request.query as Record<string, string>;
      const month = q.month ?? new Date().toISOString().slice(0, 7);

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return reply.status(400).send({ success: false, error: "month must be YYYY-MM", statusCode: 400 });
      }

      const [year, mo] = month.split("-").map(Number);
      const start = new Date(year, mo - 1, 1);
      const end   = new Date(year, mo, 0, 23, 59, 59, 999);

      const entries = await prisma.partTimeEntry.findMany({
        where: { employeeId: id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      });

      return reply.send({ success: true, data: entries });
    }
  );

  // PUT /api/v1/timesheet/entry  — upsert a single day entry (only own, only past/today)
  fastify.put("/entry", async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = entrySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    const { date, lectureHours, ptmHours, otherHours, otherReason, answerScripts } = parsed.data;

    // Block future dates
    const entryDate = new Date(date + "T00:00:00");
    const today     = new Date(); today.setHours(23, 59, 59, 999);
    if (entryDate > today) {
      return reply.status(400).send({ success: false, error: "Cannot log hours for a future date", statusCode: 400 });
    }

    // Verify employee is PART_TIME
    const employee = await prisma.employee.findUnique({
      where: { id: user.sub },
      select: { employmentType: true },
    });
    if (!employee || employee.employmentType !== "PART_TIME") {
      return reply.status(403).send({ success: false, error: "Timesheet is only for part-time employees", statusCode: 403 });
    }

    const entry = await prisma.partTimeEntry.upsert({
      where: { employeeId_date: { employeeId: user.sub, date: new Date(date + "T00:00:00") } },
      create: {
        employeeId: user.sub,
        date:       new Date(date + "T00:00:00"),
        lectureHours, ptmHours, otherHours,
        otherReason: otherReason ?? null,
        answerScripts,
      },
      update: { lectureHours, ptmHours, otherHours, otherReason: otherReason ?? null, answerScripts },
    });

    return reply.send({ success: true, data: entry });
  });
}
