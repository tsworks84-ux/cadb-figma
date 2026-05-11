import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

const ADMIN_ROLES = ["SUPER_ADMIN"] as const;

const EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  officialPhone: true,
  email: true,
  department:  { select: { name: true } },
  designation: { select: { title: true } },
};

export async function directoryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List all directory entries (all employees can view) ───────────────────
  fastify.get("/", async (_request, reply) => {
    const entries = await prisma.directoryEntry.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: { employee: { select: EMPLOYEE_SELECT } },
    });
    return reply.send({ success: true, data: entries });
  });

  // ── List employees not yet in directory (for the add picker) ──────────────
  fastify.get(
    "/available-employees",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (_request, reply) => {
      const inDirectory = await prisma.directoryEntry.findMany({ select: { employeeId: true } });
      const taken = new Set(inDirectory.map((e) => e.employeeId));

      const employees = await prisma.employee.findMany({
        where: { deletedAt: null, status: { not: "TERMINATED" } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true, firstName: true, lastName: true, photoUrl: true,
          department:  { select: { name: true } },
          designation: { select: { title: true } },
        },
      });

      return reply.send({
        success: true,
        data: employees.filter((e) => !taken.has(e.id)),
      });
    }
  );

  // ── Add an entry ──────────────────────────────────────────────────────────
  fastify.post(
    "/",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const body = z.object({
        employeeId:   z.string().min(1),
        areas:        z.string().min(1).max(500),
        displayOrder: z.number().int().optional(),
      }).safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ success: false, error: body.error.issues[0].message, statusCode: 400 });
      }

      const emp = await prisma.employee.findFirst({
        where: { id: body.data.employeeId, deletedAt: null },
      });
      if (!emp) {
        return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
      }

      const existing = await prisma.directoryEntry.findUnique({ where: { employeeId: body.data.employeeId } });
      if (existing) {
        return reply.status(409).send({ success: false, error: "Employee already in directory", statusCode: 409 });
      }

      const maxOrder = await prisma.directoryEntry.aggregate({ _max: { displayOrder: true } });
      const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      const entry = await prisma.directoryEntry.create({
        data: {
          employeeId:   body.data.employeeId,
          areas:        body.data.areas,
          displayOrder: body.data.displayOrder ?? nextOrder,
        },
        include: { employee: { select: EMPLOYEE_SELECT } },
      });

      return reply.status(201).send({ success: true, data: entry });
    }
  );

  // ── Update areas / order ──────────────────────────────────────────────────
  fastify.patch(
    "/:id",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({
        areas:        z.string().min(1).max(500).optional(),
        displayOrder: z.number().int().optional(),
      }).safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ success: false, error: body.error.issues[0].message, statusCode: 400 });
      }

      const existing = await prisma.directoryEntry.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: "Entry not found", statusCode: 404 });
      }

      const entry = await prisma.directoryEntry.update({
        where: { id },
        data: { ...body.data },
        include: { employee: { select: EMPLOYEE_SELECT } },
      });

      return reply.send({ success: true, data: entry });
    }
  );

  // ── Reorder: swap two entries ─────────────────────────────────────────────
  fastify.post(
    "/reorder",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const body = z.object({
        ids: z.array(z.string()).min(1),
      }).safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ success: false, error: "ids array required", statusCode: 400 });
      }

      await prisma.$transaction(
        body.data.ids.map((entryId, idx) =>
          prisma.directoryEntry.update({ where: { id: entryId }, data: { displayOrder: idx } })
        )
      );

      return reply.send({ success: true, data: null });
    }
  );

  // ── Delete an entry ───────────────────────────────────────────────────────
  fastify.delete(
    "/:id",
    { preHandler: requireRole(...ADMIN_ROLES) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.directoryEntry.deleteMany({ where: { id } });
      return reply.send({ success: true, data: null });
    }
  );
}
