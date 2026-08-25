import { sendMail } from "../../mailer.js";
import { renderEmail, type NotifyPayload } from "../templates.js";
import type { NotifyEvent } from "../events.js";
import type { DeliveryResult } from "./types.js";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * One recipient per message — no CC. Each person gets their own row in the
 * outbox, so a bounce to one address is visible and retryable without
 * re-sending to everyone else.
 */
export async function sendEmailNotification(
  event: NotifyEvent,
  to: string,
  payload: NotifyPayload,
): Promise<DeliveryResult> {
  if (!emailConfigured()) {
    return { status: "SKIPPED", error: "SMTP is not configured (SMTP_HOST unset)" };
  }

  const { subject, html } = renderEmail(event, payload);
  try {
    await sendMail({ to, subject, html });
    return { status: "SENT" };
  } catch (err: any) {
    // 5xx SMTP replies are permanent (bad mailbox, rejected sender); 4xx are
    // transient (greylisting, rate limits), as are socket-level failures.
    const code: number | undefined = err?.responseCode;
    const permanent = typeof code === "number" && code >= 500 && code < 600;
    return {
      status: permanent ? "FAILED" : "RETRY",
      error: `${err?.code ?? "SMTP"}${code ? ` ${code}` : ""}: ${err?.message ?? String(err)}`,
    };
  }
}
