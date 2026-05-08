import type { FastifyInstance } from "fastify";
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

export async function googleCalendarRoutes(fastify: FastifyInstance) {
  // ── Initiate OAuth flow ─────────────────────────────────────────────────────
  fastify.get(
    "/calendar/connect",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const oauth2Client = makeOAuthClient();
      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar.events"],
        prompt: "consent",
        state: user.sub,
      });
      return reply.redirect(url);
    }
  );

  // ── OAuth callback ──────────────────────────────────────────────────────────
  fastify.get(
    "/calendar/callback",
    async (request, reply) => {
      const { code, state: employeeId } = request.query as { code?: string; state?: string; error?: string };
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

      if (!code || !employeeId) {
        return reply.redirect(`${appUrl}/dashboard/todos?calendar=error`);
      }

      const oauth2Client = makeOAuthClient();
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token || !tokens.access_token) {
        return reply.redirect(`${appUrl}/dashboard/todos?calendar=error`);
      }

      await prisma.googleCalendarConnection.upsert({
        where: { employeeId },
        create: {
          employeeId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
        },
      });

      return reply.redirect(`${appUrl}/dashboard/todos?calendar=connected`);
    }
  );

  // ── Disconnect Google Calendar ──────────────────────────────────────────────
  fastify.delete(
    "/calendar/disconnect",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      await prisma.googleCalendarConnection.deleteMany({ where: { employeeId: user.sub } });
      return reply.send({ success: true, data: null });
    }
  );

  // ── Connection status ───────────────────────────────────────────────────────
  fastify.get(
    "/calendar/status",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const conn = await prisma.googleCalendarConnection.findUnique({
        where: { employeeId: user.sub },
        select: { calendarId: true, createdAt: true },
      });
      return reply.send({ success: true, data: { connected: !!conn, calendarId: conn?.calendarId ?? null } });
    }
  );
}
