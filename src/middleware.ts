import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import {
  applySessionSliding,
  decodeSession,
  getSessionCookieName,
} from "./lib/auth/session-cookie";
import { enforceIpRateLimit } from "./lib/security/http";

const intlMiddleware = createMiddleware(routing);

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/policy-briefings/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/hiring/apply") ||
    pathname.startsWith("/api/hiring/onboarding") ||
    pathname.startsWith("/api/hiring/applications") ||
    pathname.startsWith("/api/hiring/upload") ||
    pathname.startsWith("/api/dev/local-login") ||
    pathname === "/apply" ||
    pathname.startsWith("/hiring/") ||
    pathname.startsWith("/upload/") ||
    /^\/(en|sw)\/apply(\/|$)/.test(pathname) ||
    /^\/(en|sw)\/hiring\//.test(pathname) ||
    /^\/(en|sw)\/upload\//.test(pathname) ||
    /^\/(en|sw)\/sign-in(\/|$)/.test(pathname)
  );
}

function isHubPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/hub") ||
    pathname.startsWith("/departments") ||
    pathname.startsWith("/login")
  );
}

function rateLimitApi(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (path === "/api/health") {
    return enforceIpRateLimit(request, "health", 60, 60_000);
  }
  if (path === "/api/hiring/apply") {
    return enforceIpRateLimit(request, "apply", 8, 15 * 60_000);
  }
  if (
    path.startsWith("/api/hiring/candidates") ||
    path.startsWith("/api/hiring/performance-tasks") ||
    path.startsWith("/api/hiring/download") ||
    path.startsWith("/api/hiring/files")
  ) {
    return enforceIpRateLimit(request, "hiring-admin", 60, 60_000);
  }
  if (
    path.startsWith("/api/hiring/upload") ||
    path.startsWith("/api/hiring/onboarding") ||
    path.startsWith("/api/hiring/applications")
  ) {
    return enforceIpRateLimit(request, "hiring-public", 20, 15 * 60_000);
  }
  return enforceIpRateLimit(request, "api", 120, 60_000);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    const limited = rateLimitApi(request);
    if (limited) return limited;
    return applySessionSliding(request, NextResponse.next());
  }

  if (isHubPath(pathname)) {
    const raw = request.cookies.get(getSessionCookieName())?.value;
    const session = raw ? await decodeSession(raw) : null;

    if (!session && !isPublicPath(pathname) && pathname !== "/") {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      return NextResponse.redirect(login);
    }

    if (session && pathname === "/login") {
      const hub = request.nextUrl.clone();
      hub.pathname = "/hub";
      return NextResponse.redirect(hub);
    }

    return applySessionSliding(request, NextResponse.next());
  }

  const response = intlMiddleware(request);
  if (isPublicPath(pathname)) {
    return applySessionSliding(request, response);
  }

  const raw = request.cookies.get(getSessionCookieName())?.value;
  const session = raw ? await decodeSession(raw) : null;
  if (!session) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }

  return applySessionSliding(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_vercel|.*\\..*).*)", "/api/:path*"],
};
