import { NextResponse, type NextRequest } from "next/server";
import { callPartnerApi, clientIp, cookieSecure, SESSION_COOKIE } from "@/lib/server-api";

// Signs in and keeps the session token in an httpOnly cookie, so page scripts
// can never read it.
export async function POST(req: NextRequest) {
  if (req.headers.get("x-requested-with") !== "partner-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.text();
  const res = await callPartnerApi("/auth/login", {
    method: "POST",
    body,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  const data = await res.json().catch(() => ({ error: "Sign-in failed. Try again." }));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  const out = NextResponse.json({ user: data.user });
  out.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: data.expiresInSeconds,
  });
  return out;
}
