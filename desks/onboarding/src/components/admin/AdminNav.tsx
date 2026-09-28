"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import styles from "./admin.module.css";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
}

/**
 * Admin sidebar navigation. Client component so it can highlight the active
 * route via the locale-aware `usePathname` (paths are locale-stripped, e.g.
 * `/admin/sections`).
 */
export default function AdminNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  const groups: { label: string; links: NavLink[] }[] = [
    {
      label: "",
      links: [{ href: "/admin", label: t("home"), exact: true }],
    },
    {
      label: t("onboardingGroup"),
      links: [
        { href: "/admin/members", label: t("members"), exact: false },
        { href: "/admin/sections", label: t("sections"), exact: false },
        { href: "/admin/quizzes", label: t("quizzes"), exact: false },
        { href: "/admin/materials", label: t("materials"), exact: false },
        { href: "/admin/campuses", label: t("campuses"), exact: false },
        { href: "/admin/sla-bot", label: t("slaBot"), exact: false },
      ],
    },
    {
      label: t("hiringGroup"),
      links: [
        { href: "/admin/hiring", label: t("hiringBoard"), exact: true },
        {
          href: "/admin/hiring/candidates/new",
          label: t("hiringNewCandidate"),
          exact: false,
        },
        {
          href: "/admin/hiring/performance-tasks",
          label: t("hiringPerformanceTasks"),
          exact: false,
        },
        {
          href: "/admin/hiring/positions",
          label: t("hiringPositions"),
          exact: false,
        },
        {
          href: "/admin/hiring/import",
          label: t("hiringImport"),
          exact: false,
        },
      ],
    },
    {
      label: t("systemGroup"),
      links: [
        { href: "/admin/settings", label: t("settings"), exact: false },
      ],
    },
  ];

  function isActive(href: string, exact = false): boolean {
    if (exact) return pathname === href;
    if (href === "/admin/members") {
      return (
        pathname === href ||
        pathname.startsWith(`${href}/`) ||
        pathname.startsWith("/admin/members/")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className={styles.nav} aria-label="Admin">
      {groups.map((group) => (
        <div key={group.label || "home"} className={styles.navGroup}>
          {group.label && (
            <p className={styles.navGroupLabel}>{group.label}</p>
          )}
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${
                isActive(link.href, link.exact) ? styles.navLinkActive : ""
              }`}
              aria-current={
                isActive(link.href, link.exact) ? "page" : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
