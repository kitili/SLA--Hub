import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { env } from "@/lib/env";

import { catalogFiles } from "./catalogs";
import { routing } from "./routing";

/**
 * Per-request i18n configuration (next-intl v4).
 *
 * Invoked by the server for every request inside the `[locale]` segment. It
 * resolves the active locale from the segment (validating it against
 * {@link routing.locales} and falling back to the default for unknown values),
 * then loads and merges the per-area message catalogs from
 * `messages/<locale>/*.json` (file list in `src/i18n/catalogs.ts`).
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

  // Merge all namespace catalogs for the locale. Each area owns its own file
  // and each top-level namespace lives in exactly one file (the shallow merge
  // below would otherwise shadow whole namespaces) — see src/i18n/catalogs.ts
  // for the file → namespace map and docs/i18n.md. Missing files are tolerated
  // via the .catch, so areas can be filled in independently, but the dev-only
  // warn keeps a typo'd filename from failing silently.
  const catalogs = await Promise.all(
    catalogFiles.map((ns) =>
      import(`../../messages/${locale}/${ns}.json`)
        .then((m) => m.default as Record<string, unknown>)
        .catch(() => {
          if (env.NODE_ENV !== "production") {
            console.warn(`[i18n] missing catalog messages/${locale}/${ns}.json`);
          }
          return {} as Record<string, unknown>;
        }),
    ),
  );

  return {
    locale,
    messages: Object.assign({}, ...catalogs),
  };
});
