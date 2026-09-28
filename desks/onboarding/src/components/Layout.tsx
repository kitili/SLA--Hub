"use client";

/**
 * Layout — branded app shell with fixed header, collapsible sidebar, and footer.
 *
 * Ported from legacy/client/src/components/Layout.jsx.
 * react-router-dom → next/link; context props are received as typed props.
 *
 * TODO(F3 identity): replace staffName/onLogout/isAdmin props
 *   with values from the auth session once identity is wired.
 * TODO(M data-model): replace NavSection[] with the real data-model type
 *   once onboardingData / sections API is wired.
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/lib/brand";
import styles from "./Layout.module.css";

/** One sidebar navigation entry — mirrors legacy Section shape for nav. */
export interface NavSection {
  id: string;
  number: number;
  title: string;
  icon: string;
}

export interface LayoutProps {
  children: React.ReactNode;
  /** TODO(F3 identity): staff full name, undefined when not signed in */
  staffName?: string;
  /** TODO(F3 identity): called when the user clicks Sign Out */
  onLogout?: () => void;
  /** TODO(F3 identity): whether the current user has admin role */
  isAdmin?: boolean;
  /** TODO(M data-model): list of sections for sidebar nav */
  sections?: NavSection[];
}

export default function Layout({
  children,
  staffName,
  onLogout,
  isAdmin = false,
  sections = [],
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={styles.layout}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <button
          className={styles.menuToggle}
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle menu"
          type="button"
        >
          {/* Simple text glyphs — no lucide dep in new app yet */}
          {sidebarOpen ? "✕" : "☰"}
        </button>

        <Link href="/" className={styles.headerBrand}>
          <Image
            src={brand.logos.brandmarkWhite}
            alt={brand.name}
            width={120}
            height={36}
            className={styles.headerLogo}
            priority
          />
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>Onboarding Hub</span>
            <span className={styles.headerSubtitle}>{brand.tagline}</span>
          </div>
        </Link>

        {staffName && (
          <div className={styles.headerUser}>
            <span className={styles.headerUserName}>{staffName}</span>
            {onLogout && (
              <button
                type="button"
                className={styles.headerLogout}
                onClick={onLogout}
                title="Sign out"
              >
                {/* TODO(F3 identity): swap for lucide <LogOut> once dep added */}
                ⤴
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarBrandStrip}>
          <Image
            src={brand.logos.logomarkElectricBlue}
            alt=""
            width={28}
            height={28}
            className={styles.sidebarLogomark}
            aria-hidden
          />
          <span className={styles.sidebarBrandLabel}>Staff Resources</span>
        </div>

        <nav className={styles.sidebarNav}>
          <Link
            href="/"
            className={`${styles.navItem} ${styles.navItemHome}`}
            onClick={closeSidebar}
          >
            <span className={styles.navIcon}>🏠</span>
            Dashboard
          </Link>

          {/* TODO(F3 identity): admin nav items rendered based on real role */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`${styles.navItem} ${styles.navItemAdmin}`}
              onClick={closeSidebar}
            >
              <span className={styles.navIcon}>📊</span>
              Admin Dashboard
            </Link>
          )}

          <div className={styles.navDivider} />

          {/* TODO(M data-model): sections come from real data once wired */}
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/section/${section.id}`}
              className={styles.navItem}
              onClick={closeSidebar}
            >
              <span className={styles.navIcon}>{section.icon}</span>
              <span className={styles.navLabel}>
                <span className={styles.navNumber}>Section {section.number}</span>
                {section.title}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className={styles.mainContent}>{children}</main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className={styles.siteFooter}>
        <Image
          src={brand.logos.logomarkElectricBlue}
          alt=""
          width={18}
          height={18}
          className={styles.footerLogomark}
          aria-hidden
        />
        <span>
          {brand.name} · {brand.tagline}
        </span>
      </footer>
    </div>
  );
}
