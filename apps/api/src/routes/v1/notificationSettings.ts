import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { NOTIFY_EVENTS, NOTIFY_CHANNELS, GLOBAL_SETTING_KEY, EVENT_META } from "../../utils/notify/events.js";
import { readSettingsGrid } from "../../utils/notify/settings.js";

/**
 * Super-Admin control over which notifications go out on which channel.
 *
 * Hard-coded to SUPER_ADMIN rather than gated on the permission matrix, for the
 * same reason Custom Roles and Roles & Permissions are: this switches off the
 * notices that tell managers and HR what is happening, so it is not something
 * to hand out through a checkbox on some other role.
 */

const VALID_KEYS = new Set<string>([GLOBAL_SETTING_KEY, ...NOTIFY_EVENTS]);

const updateSchema = z.object({
  event: z.string().refine((e) => VALID_KEYS.has(e), "Unknown notification event"),
  emailEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
});

export async function notificationSettingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  /** The full grid, defaults filled in, plus the labels the UI renders. */
  fastify.get("/", { preHandler: requireRole("SUPER_ADMIN") }, async (_request, reply) => {
    const settings = await readSettingsGrid();
    return reply.send({
      success: true,
      data: {
        globalKey: GLOBAL_SETTING_KEY,
        channels: NOTIFY_CHANNELS,
        events: NOTIFY_EVENTS.map((event) => ({ event, ...EVENT_META[event] })),
        settings,
      },
    });
  });

  /** Upsert one row. A row only exists once it deviates from the default. */
  fastify.patch("/", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
        statusCode: 400,
      });
    }

    const { event, emailEnabled, whatsappEnabled, inAppEnabled } = parsed.data;
    const data = await prisma.notificationSetting.upsert({
      where: { event },
      create: { event, emailEnabled, whatsappEnabled, inAppEnabled, updatedById: user.sub },
      update: { emailEnabled, whatsappEnabled, inAppEnabled, updatedById: user.sub },
    });

    return reply.send({ success: true, data });
  });
}
