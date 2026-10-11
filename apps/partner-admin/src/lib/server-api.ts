import "server-only";
import type { NextRequest } from "next/server";

// Server-side only. The browser never learns partner-api's address or the
// service secret; it only ever talks to this app's own /api routes.

export const SESSION_COOKIE = "pa_session";

const apiUrl = () => {
  const url = process.env.PARTNER_API_URL;
  if (!url) throw new Error("PARTNER_API_URL is not set");
  return url.replace(/\/$/, "");
};

const secret = () => {
  const s = process.env.PARTNER_SERVICE_SECRET;
  if (!s) throw new Error("PARTNER_SERVICE_SECRET is not set");
  return s;
};

export const cookieSecure = () => process.env.COOKIE_SECURE !== "false";

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";

export async function callPartnerApi(
  path: string,
  init: { method?: string; body?: string; token?: string; ip?: string; userAgent?: string } = {},
) {
  const headers: Record<string, string> = { "x-service-secret": secret() };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  return fetch(`${apiUrl()}/admin/v1${path}`, { method: init.method ?? "GET", headers, body: init.body, cache: "no-store" });
}
