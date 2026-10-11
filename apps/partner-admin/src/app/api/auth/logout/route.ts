import { NextResponse, type NextRequest } from "next/server";
import { callPartnerApi, SESSION_COOKIE } from "@/lib/server-api";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-requested-with") !== "partner-admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await callPartnerApi("/auth/logout", { method: "POST", body: "{}", token }).catch(() => undefined);
  const out = NextResponse.json({ ok: true });
  out.cookies.delete(SESSION_COOKIE);
  return out;
}
