import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation APIs (next-intl v4).
 *
 * Use these drop-in replacements for the equivalent Next.js primitives whenever
 * a link or programmatic navigation should preserve / switch the active locale:
 *
 * - `Link`         — replaces `next/link`
 * - `redirect`     — replaces `next/navigation`'s `redirect`
 * - `usePathname`  — locale-stripped pathname (no `/en` prefix)
 * - `useRouter`    — locale-aware `push`/`replace`
 * - `getPathname`  — build an href for a given locale (used by LocaleSwitcher)
 *
 * @see docs/i18n.md
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
