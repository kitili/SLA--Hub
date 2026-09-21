import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Per-request i18n configuration (next-intl v4).
 *
 * Invoked by the server for every request inside the `[locale]` segment. It
 * resolves the active locale from the segment (validating it against
 * {@link routing.locales} and falling back to the default for unknown values),
 * then loads the matching message catalog from `messages/<locale>.json`.
 *
 * Wired into the build via `createNextIntlPlugin('./src/i18n/request.ts')`
 * in `next.config.ts`.
 *
 * @see docs/i18n.md
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is the matched `[locale]` segment (a Promise in v4).
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Merge all namespace catalogs for the locale (common + per-area files).
  // Each area owns its own file (member.json, admin.json, …) so parallel
  // work never collides on a single catalog. See docs/i18n.md.
  const namespaces = [
    "common",
    "member",
    "admin",
    "bio",
    "signoff",
    "feedback",
    "policies",
    "errors",
    "sla-bot",
    "admin-sla-bot",
  ] as const;
  const catalogs = await Promise.all(
    namespaces.map((ns) =>
      import(`../../messages/${locale}/${ns}.json`)
        .then((m) => m.default as Record<string, unknown>)
        .catch(() => ({}) as Record<string, unknown>),
    ),
  );

  return {
    locale,
    messages: Object.assign({}, ...catalogs),
  };
});
