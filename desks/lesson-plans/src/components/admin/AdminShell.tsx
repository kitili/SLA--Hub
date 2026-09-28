"use client";

/**
 * AdminShell — the admin layout chrome.
 *
 * Composes the navy {@link ./AdminSidebar} with a slim content top-bar and the
 * page `<main>`. Owns the two pieces of shell UI state:
 *
 *   • `collapsed` — desktop icon-only rail, persisted to localStorage.
 *   • `drawerOpen` — mobile (≤900px) off-canvas drawer + scrim.
 *
 * The same sidebar element is a sticky column on desktop and a fixed off-canvas
 * drawer on phones/tablets (switched purely by CSS media queries). The page
 * title in the top-bar is derived from the active route so every admin page
 * gets a consistent header for free. Auth/data live in the server
 * {@link ../../app/[locale]/admin/layout admin layout}, which renders this.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import AdminSidebar from "./AdminSidebar";
import Icon from "./icons";
import styles from "./AdminShell.module.css";

const COLLAPSE_KEY = "admin:sidebar-collapsed";

/** Which top-level section is the active route in? Drives the top-bar title. */
function sectionKey(
  pathname: string,
): "dashboard" | "aiStudio" | "plans" | "feedback" {
  if (pathname.startsWith("/admin/ai-studio")) return "aiStudio";
  if (pathname.startsWith("/admin/plans")) return "plans";
  if (pathname.startsWith("/admin/feedback")) return "feedback";
  return "dashboard";
}

export default function AdminShell({
  userName,
  roleLabel,
  children,
}: {
  userName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("lpAdmin.nav");
  const tAdmin = useTranslations("admin");

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Restore the desktop collapse preference after hydration (avoids SSR/client
  // markup mismatch — the server can't read localStorage).
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode / disabled storage — keep the default. */
    }
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  }

  const title = t(sectionKey(pathname));

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ""}`}>
      <div
        className={`${styles.sidebarWrap} ${drawerOpen ? styles.drawerOpen : ""}`}
      >
        <AdminSidebar
          userName={userName}
          roleLabel={roleLabel}
          collapsed={collapsed}
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>

      <button
        type="button"
        className={`${styles.scrim} ${drawerOpen ? styles.scrimVisible : ""}`}
        aria-hidden={!drawerOpen}
        tabIndex={drawerOpen ? 0 : -1}
        aria-label={t("ariaLabel")}
        onClick={() => setDrawerOpen(false)}
      ></button>

      <div className={styles.content}>
        <header className={styles.topbar}>
          {/* Mobile: open the drawer. */}
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setDrawerOpen(true)}
            aria-label={t("openMenu")}
          >
            <Icon name="menu" size={22} />
          </button>

          {/* Desktop: collapse/expand the rail. */}
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            aria-pressed={collapsed}
          >
            <Icon
              name="collapse"
              size={20}
              className={collapsed ? styles.collapseIconFlipped : undefined}
            />
          </button>

          <div className={styles.heading}>
            <span className={styles.eyebrow}>{tAdmin("title")}</span>
            <span className={styles.title}>{title}</span>
          </div>

          <Link href="/" className={styles.hub}>
            <Icon name="back" size={16} />
            <span>{tAdmin("nav.backToHub")}</span>
          </Link>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
