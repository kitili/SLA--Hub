import { defineRouting } from "next-intl/routing";

/**
 * Central locale routing configuration for the app (next-intl v4).
 *
 * - `locales`      — every locale the app serves. EN is the source language,
 *                    SW (Swahili) is the first translation target.
 * - `defaultLocale`— used when no locale prefix is present and for fallbacks.
 *
 * The middleware (`middleware.ts`), the navigation helpers
 * (`src/i18n/navigation.ts`) and the per-request config
 * (`src/i18n/request.ts`) are all derived from this single source of truth, so
 * adding a locale is a one-line change here plus a new `messages/<locale>.json`.
 *
 * @see docs/i18n.md
 */
export const routing = defineRouting({
  locales: ["en", "sw"],
  defaultLocale: "en",
});

/** Union of supported locale codes, derived from {@link routing}. */
export type Locale = (typeof routing.locales)[number];
