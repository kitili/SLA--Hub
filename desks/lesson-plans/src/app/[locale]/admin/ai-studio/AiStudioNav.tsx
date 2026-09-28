"use client";

/**
 * AiStudioNav — sub-navigation for the AI Studio section.
 *
 * Renders below the main {@link ../../../../components/admin/AdminNav AdminNav},
 * inside the AI Studio layout, and groups the studio generator together with the
 * supporting management pages (Schemes of Work, Textbooks, Settings) that used to
 * be top-level admin tabs. Active-section highlighting mirrors AdminNav: the
 * "Studio" root is an exact match, deeper pages match by prefix. Links are
 * locale-aware.
 */

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import styles from "./AiStudioNav.module.css";

interface SubNavItem {
  href: string;
  labelKey: "studio" | "schemes" | "textbooks" | "settings";
}

const ITEMS: SubNavItem[] = [
  { href: "/admin/ai-studio", labelKey: "studio" },
  { href: "/admin/ai-studio/schemes", labelKey: "schemes" },
  { href: "/admin/ai-studio/textbooks", labelKey: "textbooks" },
  { href: "/admin/ai-studio/settings", labelKey: "settings" },
];

/**
 * Is `href` the active sub-section for `pathname`?
 *
 * The studio root (`/admin/ai-studio`) is an exact match only, otherwise it
 * would light up on every nested page. Deeper pages match the prefix.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/ai-studio") return pathname === "/admin/ai-studio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AiStudioNav() {
  const pathname = usePathname();
  const t = useTranslations("lpStudio.subnav");

  return (
    <nav className={styles.nav} aria-label={t("ariaLabel")}>
      <ul className={styles.list}>
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={active ? "page" : undefined}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
