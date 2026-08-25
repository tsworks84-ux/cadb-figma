import { whatsappTemplate, type NotifyPayload } from "../templates.js";
import type { NotifyEvent } from "../events.js";
import type { DeliveryResult } from "./types.js";

/**
 * WhatsApp delivery via Meta's Cloud API directly — no BSP, no SDK, just a POST.
 *
 * Required environment:
 *   WHATSAPP_PHONE_NUMBER_ID   the sending number's id from WhatsApp Manager
 *   WHATSAPP_TOKEN             a permanent System User access token
 *   WHATSAPP_LANG              template language code (default "en")
 *   WHATSAPP_API_VERSION       Graph API version (default "v21.0")
 *   WHATSAPP_TEMPLATE_*        per-event template names (see templates.ts)
 *
 * With none of it set the channel reports SKIPPED, exactly as email does
 * without SMTP — the feature degrades to email-only rather than erroring.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TOKEN);
}

/**
 * Meta error codes that will never succeed on retry: the recipient has no
 * WhatsApp account, the template is missing or unapproved, or we are blocked.
 * Everything else (rate limits, 5xx, transport errors) is worth retrying.
 * Reference: developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
const PERMANENT_CODES = new Set([131026, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 133010]);

export async function sendWhatsappNotification(
  event: NotifyEvent,
  to: string,
  payload: NotifyPayload,
): Promise<DeliveryResult> {
  if (!whatsappConfigured()) {
    return { status: "SKIPPED", error: "WhatsApp is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN unset)" };
  }

  const { name, params } = whatsappTemplate(event, payload);
  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    // Meta wants the number without the leading "+".
    to: to.replace(/^\+/, ""),
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_LANG ?? "en" },
      components: [
        { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
      ],
    },
  };

  // Meta occasionally hangs; without a deadline a stuck request would hold a
  // dispatcher slot until the process restarts.
  const abort = AbortSignal.timeout(15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abort,
    });
  } catch (err: any) {
    return { status: "RETRY", error: `Network: ${err?.message ?? String(err)}` };
  }

  const text = await res.text();
  if (res.ok) return { status: "SENT" };

  let code: number | undefined;
  let message = text.slice(0, 500);
  try {
    const parsed = JSON.parse(text);
    code = parsed?.error?.code;
    message = parsed?.error?.error_user_msg ?? parsed?.error?.message ?? message;
  } catch {
    // Non-JSON error body — keep the raw text.
  }

  // 401/403 mean the token is wrong or expired: retrying cannot fix it, and a
  // silent retry loop would hide an expired token for hours.
  const permanent =
    res.status === 401 || res.status === 403 || (code !== undefined && PERMANENT_CODES.has(code));

  return {
    status: permanent ? "FAILED" : "RETRY",
    error: `Meta ${res.status}${code ? ` (${code})` : ""}: ${message}`,
  };
}
