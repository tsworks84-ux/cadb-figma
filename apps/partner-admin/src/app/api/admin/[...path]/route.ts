import { NextResponse, type NextRequest } from "next/server";
import { callPartnerApi, clientIp, SESSION_COOKIE } from "@/lib/server-api";

// Forwards the console's API calls to partner-api with the session token from
// the httpOnly cookie and the service secret.

type Ctx = { params: Promise<{ path: string[] }> };

// Sign-in and sign-out have their own routes, which manage the cookie.
const BLOCKED = new Set(["auth/login", "auth/logout"]);

async function forward(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p === "." || p.includes("/") || p.includes("\\"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const joined = path.map(encodeURIComponent).join("/");
  if (BLOCKED.has(joined)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every state-changing call must carry this header. Browsers won't send a
  // custom header cross-site without CORS, which this app never allows.
  if (req.method !== "GET" && req.headers.get("x-requested-with") !== "partner-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.text();
  const res = await callPartnerApi(`/${joined}${req.nextUrl.search}`, {
    method: req.method,
    body,
    token,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  const text = res.status === 204 ? null : await res.text();
  const out = new NextResponse(text, {
    status: res.status,
    headers: text ? { "content-type": "application/json" } : undefined,
  });
  if (res.status === 401) out.cookies.delete(SESSION_COOKIE);
  return out;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
