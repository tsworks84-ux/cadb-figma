import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "../../../uploads/tasks");
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const ASSIGNABLE_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD"] as const;

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Create task (any authenticated user who is a team owner) ──────────────
  fastify.post(
    "/",
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const parts = request.parts();

      const fields: Record<string, string> = {};
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      for await (const part of parts) {
        if (part.type === "file") {
          if (!ALLOWED_MIME.has(part.mimetype)) {
            return reply.status(400).send({ success: false, error: "File type not allowed", statusCode: 400 });
          }
          const ext = part.filename.split(".").pop() ?? "bin";
          const fileName = `${randomUUID()}.${ext}`;
          const filePath = join(UPLOADS_DIR, fileName);
          await pipeline(part.file, createWriteStream(filePath));
          attachmentUrl = `/uploads/tasks/${fileName}`;
          attachmentName = part.filename;
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      const parsed = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        assignedToId: z.string().min(1),
        assignedDate: z.string(),
        dueDate: z.string(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      }).safeParse(fields);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false, error: "Validation failed",
          details: parsed.error.flatten().fieldErrors, statusCode: 400,
        });
      }

      const d = parsed.data;

      // Verify the assignee exists
      const assignee = await prisma.employee.findFirst({ where: { id: d.assignedToId, deletedAt: null } });
      if (!assignee) {
        return reply.status(404).send({ success: false, error: "Assignee not found", statusCode: 404 });
      }

      // SA / HR_ADMIN can assign to anyone; everyone else must assign to their own team members
      const isSuperAssigner = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
      if (!isSuperAssigner) {
        const membership = await prisma.teamMembership.findFirst({
          where: { teamOwnerId: user.sub, memberId: d.assignedToId },
        });
        if (!membership) {
          return reply.status(403).send({
            success: false,
            error: "You can only assign tasks to your own team members",
            statusCode: 403,
          });
        }
      }

      const task = await prisma.task.create({
        data: {
          title: d.title,
          description: d.description,
          assignedById: user.sub,
          assignedToId: d.assignedToId,
          assignedDate: new Date(d.assignedDate),
          dueDate: new Date(d.dueDate),
          priority: d.priority,
          attachmentUrl,
          attachmentName,
        },
        include: {
          assignedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      });

      return reply.status(201).send({ success: true, data: task });
    }
  );

  // ── List tasks ───────────────────────────────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const q = request.query as Record<string, string>;
    const assignedToId = q.assignedToId;
    const assignedById = q.assignedById;
    const status = q.status;
    const priority = q.priority;

    // Employees can only see their own tasks
    if (user.role === "EMPLOYEE") {
      if (assignedToId && assignedToId !== user.sub) {
        return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
      }
    }

    const tasks = await prisma.task.findMany({
      where: {
        ...(assignedToId && { assignedToId }),
        ...(assignedById && { assignedById }),
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
      },
      include: {
        assignedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return reply.send({ success: true, data: tasks });
  });

  // ── Update task ──────────────────────────────────────────────────────────────
  fastify.patch("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return reply.status(404).send({ success: false, error: "Task not found", statusCode: 404 });
    }

    // Employees can only update status on their own tasks
    if (user.role === "EMPLOYEE") {
      if (task.assignedToId !== user.sub) {
        return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
      }
      const parsed = z.object({
        status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      }).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: "Invalid status", statusCode: 400 });
      }
      const updated = await prisma.task.update({ where: { id }, data: { status: parsed.data.status } });
      return reply.send({ success: true, data: updated });
    }

    // Supervisors / admins can update anything
    const parsed = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    const d = parsed.data;
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(d.title && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.dueDate && { dueDate: new Date(d.dueDate) }),
        ...(d.priority && { priority: d.priority }),
        ...(d.status && { status: d.status }),
      },
      include: {
        assignedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    return reply.send({ success: true, data: updated });
  });

  // ── Delete task ──────────────────────────────────────────────────────────────
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return reply.status(404).send({ success: false, error: "Task not found", statusCode: 404 });
    }

    // SA / HR_ADMIN can delete anything; everyone else can only delete tasks they created
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAdmin && task.assignedById !== user.sub) {
      return reply.status(403).send({ success: false, error: "You can only delete tasks you assigned", statusCode: 403 });
    }

    await prisma.task.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // ── Get single task with comments ────────────────────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true, photoUrl: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true, photoUrl: true } },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
            replies: {
              include: {
                author: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!task) {
      return reply.status(404).send({ success: false, error: "Task not found", statusCode: 404 });
    }

    // Employees can only view tasks they're assigned to
    if (user.role === "EMPLOYEE" && task.assignedToId !== user.sub) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    return reply.send({ success: true, data: task });
  });

  // ── Add comment ───────────────────────────────────────────────────────────────
  fastify.post("/:id/comments", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return reply.status(404).send({ success: false, error: "Task not found", statusCode: 404 });
    }

    // Only assigner, assignee, SA, or HR can comment
    const isInvolved = task.assignedById === user.sub || task.assignedToId === user.sub;
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isInvolved && !isAdmin) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const parsed = z.object({
      body: z.string().min(1).max(2000),
      parentId: z.string().optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: user.sub,
        body: parsed.data.body,
        parentId: parsed.data.parentId ?? null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        replies: {
          include: { author: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
        },
      },
    });

    return reply.status(201).send({ success: true, data: comment });
  });

  // ── Delete comment ────────────────────────────────────────────────────────────
  fastify.delete("/:id/comments/:commentId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { commentId } = request.params as { id: string; commentId: string };

    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return reply.status(404).send({ success: false, error: "Comment not found", statusCode: 404 });
    }

    const isAuthor = comment.authorId === user.sub;
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
    if (!isAuthor && !isAdmin) {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    await prisma.taskComment.delete({ where: { id: commentId } });
    return reply.send({ success: true, data: null });
  });
}
