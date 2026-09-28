import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Locale negotiation middleware (next-intl v4).
 *
 * Redirects locale-less requests to a prefixed path (e.g. `/` → `/en`) and
 * makes the matched `[locale]` segment available to `src/i18n/request.ts`.
 *
 * @see docs/i18n.md
 */
export default createMiddleware(routing);

export const config = {
  /**
   * Run on every pathname EXCEPT:
   *   - `/api`        — route handlers are locale-agnostic
   *   - `/_next`      — Next.js internals and build assets
   *   - `/_vercel`    — platform internals
   *   - any path containing a dot (`.`) — static files (favicon, images, …)
   */
  matcher: ["/", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
