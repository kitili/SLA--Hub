"use client";

/**
 * LocaleSwitcher — toggles the active locale (EN ↔ SW) while preserving the
 * current route.
 *
 * Reference implementation for the i18n substrate (F4): the only component
 * migrated to `useTranslations` in this epic. It uses next-intl's locale-aware
 * navigation so switching language re-renders the same page under the other
 * locale prefix (`/en/...` ↔ `/sw/...`).
 *
 * @see docs/i18n.md
 */

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LocaleSwitcher() {
  const t = useTranslations("common");
  const activeLocale = useLocale();
  const router = useRouter();
  // Locale-stripped pathname (e.g. "/admin", not "/en/admin").
  const pathname = usePathname();

  function onSelect(nextLocale: string) {
    if (nextLocale === activeLocale) return;
    // `pathname` carries no locale prefix; `locale` tells next-intl which one
    // to apply when building the target URL.
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <label>
      <select
        value={activeLocale}
        onChange={(event) => onSelect(event.target.value)}
        aria-label={t("language")}
      >
        {routing.locales.map((locale) => (
          <option key={locale} value={locale}>
            {locale === "en" ? t("english") : t("swahili")}
          </option>
        ))}
      </select>
    </label>
  );
}
