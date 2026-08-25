import { prisma } from "@cadb/db";
import { sendEmailNotification } from "./channels/email.js";
import { sendWhatsappNotification } from "./channels/whatsapp.js";
import type { NotifyPayload } from "./templates.js";
import type { NotifyEvent } from "./events.js";

/**
 * Delivery side of the notification outbox: drains PENDING rows, sends them,
 * and records what happened. Runs on an interval from server.ts, the same
 * pattern as the probation check.
 *
 * Deliberately not a queue library. Redis is a dependency of this app but
 * unused, and BullMQ would be a lot of moving parts for a handful of messages
 * per leave. A polled table gives retries, backoff and a delivery record with
 * nothing new to operate.
 */

/** Attempt N waits BACKOFF_MINUTES[N-1] before the next try. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 360];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

const BATCH_SIZE = 25;

/**
 * A row claimed by a process that then died stays SENDING forever. Anything
 * held longer than this is assumed abandoned and returned to the queue.
 * Comfortably longer than the 15s provider timeout.
 */
const STALE_CLAIM_MINUTES = 10;

/** Guards against a slow run overlapping the next tick in the same process. */
let running = false;

export type DrainSummary = { sent: number; failed: number; skipped: number; retried: number };

export async function drainNotifications(): Promise<DrainSummary> {
  const summary: DrainSummary = { sent: 0, failed: 0, skipped: 0, retried: 0 };
  if (running) return summary;
  running = true;

  try {
    await reclaimStaleClaims();

    const candidates = await prisma.notification.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: BATCH_SIZE,
    });

    for (const row of candidates) {
      // Claim the row before touching a provider. The `status: "PENDING"` guard
      // makes this atomic, so a second process racing us updates 0 rows and
      // moves on — nobody sends the same message twice.
      const claim = await prisma.notification.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING", attempts: { increment: 1 } },
      });
      if (claim.count === 0) continue;

      const attempts = row.attempts + 1;
      const event = row.event as NotifyEvent;
      const payload = row.payload as unknown as NotifyPayload;

      const result =
        row.channel === "EMAIL"
          ? await sendEmailNotification(event, row.destination, payload)
          : await sendWhatsappNotification(event, row.destination, payload);

      if (result.status === "SENT") {
        summary.sent++;
        await prisma.notification.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date(), lastError: null },
        });
        continue;
      }

      if (result.status === "SKIPPED" || result.status === "FAILED") {
        result.status === "SKIPPED" ? summary.skipped++ : summary.failed++;
        await prisma.notification.update({
          where: { id: row.id },
          data: { status: result.status, lastError: result.error ?? null },
        });
        continue;
      }

      // RETRY — unless we have run out of attempts, in which case it is a
      // failure with the last transient error recorded as the cause.
      if (attempts >= MAX_ATTEMPTS) {
        summary.failed++;
        await prisma.notification.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            lastError: `Gave up after ${attempts} attempts — ${result.error ?? "unknown error"}`,
          },
        });
        continue;
      }

      summary.retried++;
      const waitMinutes = BACKOFF_MINUTES[attempts - 1] ?? BACKOFF_MINUTES.at(-1)!;
      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          lastError: result.error ?? null,
          nextAttemptAt: new Date(Date.now() + waitMinutes * 60_000),
        },
      });
    }

    return summary;
  } finally {
    running = false;
  }
}

async function reclaimStaleClaims(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000);
  const { count } = await prisma.notification.updateMany({
    where: { status: "SENDING", updatedAt: { lt: cutoff } },
    data: { status: "PENDING", lastError: "Reclaimed after an interrupted send" },
  });
  if (count > 0) console.warn(`[notify] reclaimed ${count} stale notification(s)`);
}
