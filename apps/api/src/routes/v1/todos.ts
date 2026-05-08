import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { google } from "googleapis";

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getAuthedClient(employeeId: string) {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { employeeId } });
  if (!conn) return null;
  const oauth2Client = makeOAuthClient();
  oauth2Client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiresAt.getTime(),
  });
  return oauth2Client;
}

function computeReminderAt(dueDate: Date, reminderType: string, customReminderAt?: Date): Date | null {
  if (reminderType === "NONE") return null;
  if (reminderType === "ON_DUE_DATE") return dueDate;
  if (reminderType === "THIRTY_MIN_BEFORE") return new Date(dueDate.getTime() - 30 * 60 * 1000);
  if (reminderType === "ONE_HOUR_BEFORE") return new Date(dueDate.getTime() - 60 * 60 * 1000);
  if (reminderType === "THREE_HOURS_BEFORE") return new Date(dueDate.getTime() - 3 * 60 * 60 * 1000);
  if (reminderType === "ONE_DAY_BEFORE") return new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
  if (reminderType === "TWO_DAYS_BEFORE") return new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000);
  if (reminderType === "ONE_WEEK_BEFORE") return new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (reminderType === "CUSTOM" && customReminderAt) return customReminderAt;
  return null;
}

async function syncToGoogleCalendar(
  employeeId: string,
  todo: { id: string; title: string; description?: string | null; dueDate: Date; reminderAt: Date | null; googleEventId?: string | null }
): Promise<string | null> {
  const auth = await getAuthedClient(employeeId);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth });
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { employeeId } });
  const calendarId = conn?.calendarId ?? "primary";

  const reminderMinutes = todo.reminderAt && todo.dueDate
    ? Math.max(0, Math.round((todo.dueDate.getTime() - todo.reminderAt.getTime()) / 60000))
    : 0;

  const eventBody = {
    summary: todo.title,
    description: todo.description ?? undefined,
    start: { dateTime: todo.dueDate.toISOString() },
    end: { dateTime: new Date(todo.dueDate.getTime() + 30 * 60000).toISOString() },
    reminders: reminderMinutes > 0
      ? { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }, { method: "email", minutes: reminderMinutes }] }
      : { useDefault: false, overrides: [] },
  };

  try {
    if (todo.googleEventId) {
      const res = await calendar.events.update({ calendarId, eventId: todo.googleEventId, requestBody: eventBody });
      return res.data.id ?? null;
    } else {
      const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
      return res.data.id ?? null;
    }
  } catch {
    return null;
  }
}

async function deleteFromGoogleCalendar(employeeId: string, googleEventId: string): Promise<void> {
  const auth = await getAuthedClient(employeeId);
  if (!auth) return;
  const calendar = google.calendar({ version: "v3", auth });
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { employeeId } });
  const calendarId = conn?.calendarId ?? "primary";
  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
  } catch { /* ignore */ }
}

const REMINDER_ENUM = ["NONE", "ON_DUE_DATE", "THIRTY_MIN_BEFORE", "ONE_HOUR_BEFORE", "THREE_HOURS_BEFORE", "ONE_DAY_BEFORE", "TWO_DAYS_BEFORE", "ONE_WEEK_BEFORE", "CUSTOM"] as const;

const todoCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  reminderType: z.enum(REMINDER_ENUM).optional(),
  reminderAt: z.string().datetime().optional(),
});

const todoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  completed: z.boolean().optional(),
  reminderType: z.enum(REMINDER_ENUM).optional(),
  reminderAt: z.string().datetime().nullable().optional(),
});

export async function todoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List todos ──────────────────────────────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { filter } = request.query as { filter?: string };

    const where: Record<string, unknown> = { employeeId: user.sub };
    if (filter === "active") where["completed"] = false;
    if (filter === "completed") where["completed"] = true;

    const todos = await prisma.personalTodo.findMany({
      where,
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    const calendarConnected = !!(await prisma.googleCalendarConnection.findUnique({ where: { employeeId: user.sub } }));
    return reply.send({ success: true, data: todos, calendarConnected });
  });

  // ── Create todo ─────────────────────────────────────────────────────────────
  fastify.post("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = todoCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0].message, statusCode: 400 });
    }
    const { title, description, category, dueDate, priority, reminderType, reminderAt } = parsed.data;
    const dueDateObj = dueDate ? new Date(dueDate) : null;
    const rType = reminderType ?? "NONE";
    const reminderAtComputed = dueDateObj ? computeReminderAt(dueDateObj, rType, reminderAt ? new Date(reminderAt) : undefined) : null;

    const todo = await prisma.personalTodo.create({
      data: {
        employeeId: user.sub,
        title,
        description,
        category: category ?? "General",
        dueDate: dueDateObj,
        priority: priority ?? "MEDIUM",
        reminderType: rType,
        reminderAt: reminderAtComputed,
      },
    });

    let googleEventId: string | null = null;
    if (dueDateObj) {
      googleEventId = await syncToGoogleCalendar(user.sub, { ...todo, dueDate: dueDateObj, reminderAt: reminderAtComputed });
      if (googleEventId) {
        await prisma.personalTodo.update({ where: { id: todo.id }, data: { googleEventId } });
        todo.googleEventId = googleEventId;
      }
    }

    return reply.status(201).send({ success: true, data: todo });
  });

  // ── Update todo ─────────────────────────────────────────────────────────────
  fastify.patch("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.personalTodo.findFirst({ where: { id, employeeId: user.sub } });
    if (!existing) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    const parsed = todoUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0].message, statusCode: 400 });
    }
    const updates = parsed.data;

    const dueDateObj = updates.dueDate !== undefined
      ? (updates.dueDate ? new Date(updates.dueDate) : null)
      : existing.dueDate;
    const rType = updates.reminderType ?? existing.reminderType;
    const reminderAt = dueDateObj
      ? computeReminderAt(dueDateObj, rType, updates.reminderAt ? new Date(updates.reminderAt) : existing.reminderAt ?? undefined)
      : null;

    const todo = await prisma.personalTodo.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        dueDate: dueDateObj,
        reminderType: rType,
        reminderAt,
        ...(updates.completed !== undefined && {
          completed: updates.completed,
          completedAt: updates.completed ? new Date() : null,
        }),
      },
    });

    if (dueDateObj) {
      const googleEventId = await syncToGoogleCalendar(user.sub, { ...todo, dueDate: dueDateObj, reminderAt });
      if (googleEventId && googleEventId !== todo.googleEventId) {
        await prisma.personalTodo.update({ where: { id }, data: { googleEventId } });
        todo.googleEventId = googleEventId;
      }
    }

    return reply.send({ success: true, data: todo });
  });

  // ── Delete todo ─────────────────────────────────────────────────────────────
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const existing = await prisma.personalTodo.findFirst({ where: { id, employeeId: user.sub } });
    if (!existing) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });

    if (existing.googleEventId) {
      await deleteFromGoogleCalendar(user.sub, existing.googleEventId);
    }
    await prisma.personalTodo.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
