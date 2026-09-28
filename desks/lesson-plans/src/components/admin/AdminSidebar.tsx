"use client";

/**
 * AdminSidebar — primary navigation for the admin area.
 *
 * Replaces the former horizontal admin tab bar. Renders a navy rail with the
 * admin brand lockup, icon-led section links, and a user footer.
 * Active-section highlighting reuses the exact/prefix logic the tab bar used:
 * "/admin" matches exactly, deeper sections match by prefix so e.g.
 * `/admin/plans/foo/edit` keeps "Plans" lit.
 *
 * Presentational only — the open/collapsed shell state is owned by
 * {@link ./AdminShell}, which passes `collapsed` and an `onNavigate` callback
 * (used to close the mobile drawer when a link is followed).
 */

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import Icon, { type IconName } from "./icons";
import styles from "./AdminSidebar.module.css";

interface NavItem {
  href: string;
  labelKey: "dashboard" | "aiStudio" | "plans" | "feedback";
  icon: IconName;
}

const ITEMS: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: "dashboard" },
  { href: "/admin/ai-studio", labelKey: "aiStudio", icon: "aiStudio" },
  { href: "/admin/plans", labelKey: "plans", icon: "plans" },
  { href: "/admin/feedback", labelKey: "feedback", icon: "feedback" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** First letters of the user's name (or email local-part) for the avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function AdminSidebar({
  userName,
  roleLabel,
  collapsed,
  onNavigate,
}: {
  userName: string;
  roleLabel: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("lpAdmin.nav");

  return (
    <nav
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      aria-label={t("ariaLabel")}
    >
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          S
        </span>
        <span className={styles.wordmark}>Silverleaf</span>
      </div>

      <ul className={styles.list}>
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const label = t(item.labelKey);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.link} ${active ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                onClick={onNavigate}
              >
                <span className={styles.icon}>
                  <Icon name={item.icon} size={20} />
                </span>
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer}>
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(userName)}
        </span>
        <span className={styles.identity}>
          <span className={styles.name}>{userName}</span>
          <span className={styles.role}>{roleLabel}</span>
        </span>
      </div>
    </nav>
  );
}
