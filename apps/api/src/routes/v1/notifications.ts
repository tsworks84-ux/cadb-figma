import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import type { JwtPayload } from "@cadb/types";
import { renderInApp, type NotifyPayload } from "../../utils/notify/templates.js";
import { EVENT_META, type NotifyEvent } from "../../utils/notify/events.js";

/**
 * The bell. Reads the IN_APP rows of the same outbox that carries email and
 * WhatsApp, so a notice is one event with one audience however it is delivered
 * — there is no second table to keep in step.
 *
 * Self-service by design: every authenticated employee reads and clears their
 * own feed and nobody else's, so there is no permission-matrix module here.
 * `recipientId` is matched against the token on every write; an id belonging to
 * someone else looks exactly like an id that does not exist.
 */

/** Enough to fill the dropdown and its "older" scroll without paging. */
const FEED_LIMIT = 50;

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  /** The signed-in employee's feed, newest first, cleared ones omitted. */
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;

    const rows = await prisma.notification.findMany({
      where: { recipientId: user.sub, channel: "IN_APP", dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    });

    const items = rows.map((row) => {
      const event = row.event as NotifyEvent;
      const payload = row.payload as unknown as NotifyPayload;
      const { title, body } = renderInApp(event, payload);
      return {
        id: row.id,
        event,
        group: EVENT_META[event]?.group ?? "Leaves",
        title,
        body,
        // Relative so the client can route without a page load. Older rows
        // predate `path` in the payload, hence the fallback.
        path: payload.path ?? "/dashboard/home",
        entityType: row.entityType,
        entityId: row.entityId,
        read: row.readAt !== null,
        createdAt: row.createdAt,
      };
    });

    return reply.send({
      success: true,
      data: { items, unreadCount: items.filter((i) => !i.read).length },
    });
  });

  /** Mark one as read. Opening a notice is not the same as clearing it. */
  fastify.patch("/:id/read", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const { count } = await prisma.notification.updateMany({
      where: { id, recipientId: user.sub, channel: "IN_APP", readAt: null },
      data: { readAt: new Date() },
    });

    // count === 0 also covers "already read", which is not an error worth
    // showing anyone — the caller wanted it read and it is read.
    return reply.send({ success: true, data: { updated: count } });
  });

  /** Mark the whole feed read. */
  fastify.post("/read-all", async (request, reply) => {
    const user = request.user as JwtPayload;

    const { count } = await prisma.notification.updateMany({
      where: { recipientId: user.sub, channel: "IN_APP", dismissedAt: null, readAt: null },
      data: { readAt: new Date() },
    });

    return reply.send({ success: true, data: { updated: count } });
  });

  /**
   * Clear one. A soft dismiss, not a delete: the row is also the delivery
   * record for this event, and tidying the bell must not erase the evidence
   * that someone was told.
   */
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const now = new Date();

    const { count } = await prisma.notification.updateMany({
      where: { id, recipientId: user.sub, channel: "IN_APP", dismissedAt: null },
      data: { dismissedAt: now, readAt: now },
    });
    if (count === 0) {
      return reply.status(404).send({ success: false, error: "Notification not found", statusCode: 404 });
    }

    return reply.send({ success: true, data: { cleared: count } });
  });

  /** Clear the whole feed. */
  fastify.delete("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const now = new Date();

    const { count } = await prisma.notification.updateMany({
      where: { recipientId: user.sub, channel: "IN_APP", dismissedAt: null },
      data: { dismissedAt: now, readAt: now },
    });

    return reply.send({ success: true, data: { cleared: count } });
  });
}
