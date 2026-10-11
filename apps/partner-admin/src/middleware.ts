import { NextResponse, type NextRequest } from "next/server";

// Pages need a session cookie; the API routes check the session themselves.
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get("pa_session")?.value);
  const { pathname, search } = req.nextUrl;

  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/projects", req.url)) : NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt).*)"],
};
