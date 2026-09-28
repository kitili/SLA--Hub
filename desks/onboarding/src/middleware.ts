import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { applySessionSliding } from "./lib/auth/session-cookie";
import { enforceIpRateLimit } from "./lib/security/http";

/**
 * Locale negotiation middleware (next-intl v4), plus sliding session timeout
 * and API rate limits.
 *
 * Redirects locale-less requests to a prefixed path (e.g. `/` → `/en`) and
 * makes the matched `[locale]` segment available to `src/i18n/request.ts`.
 *
 * After locale routing, a valid session cookie is refreshed (15-minute idle
 * window) and an expired/tampered cookie is dropped so the next page load
 * shows the sign-in screen.
 *
 * `/api` is locale-agnostic: skip next-intl, rate-limit by IP, then slide
 * the session so API calls count as activity.
 *
 * @see docs/i18n.md
 */
const intlMiddleware = createMiddleware(routing);

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
  if (request.nextUrl.pathname.startsWith("/api")) {
    const limited = rateLimitApi(request);
    if (limited) return limited;
    return applySessionSliding(request, NextResponse.next());
  }

  const response = intlMiddleware(request);
  return applySessionSliding(request, response);
}

export const config = {
  /**
   * Run on every pathname EXCEPT:
   *   - `/_next`        — Next.js internals and build assets
   *   - `/_vercel`      — platform internals
   *   - any path containing a dot (`.`) — static files (favicon, images, …)
   *
   * `/api` is included so rate limits apply. Locale routing is skipped there.
   */
  matcher: [
    "/",
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/api/:path*",
  ],
};
