"use client";

/**
 * SiteNav — the app's top navigation bar with a mobile-friendly menu.
 *
 * Desktop (> 600px): brandmark on the left, links laid out inline on the right
 * exactly as before.
 *
 * Phone (≤ 600px): the links collapse behind a hamburger button that toggles a
 * right-side drawer. The drawer closes on route change (covers link clicks and
 * the locale switch), on Escape, and on a tap of the dimming scrim. Body scroll
 * is locked while it is open.
 *
 * The nav links themselves (Dashboard, Admin, LocaleSwitcher, LogoutButton) are
 * passed in as `children` from the server layout so their server-derived state
 * (auth/admin) stays on the server — this component only owns the open/close UI.
 */

import { useEffect, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { brand } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

export interface SiteNavProps {
  /** The nav link items, rendered inline on desktop and stacked in the drawer. */
  children: React.ReactNode;
  /** Translated aria-label for the hamburger when the menu is closed. */
  openLabel: string;
  /** Translated aria-label for the hamburger when the menu is open. */
  closeLabel: string;
}

export default function SiteNav({ children, openLabel, closeLabel }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — a tapped link or a locale switch changes the path.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While the drawer is open: lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <nav className="site-nav" data-open={open || undefined}>
      <Link href="/" className="site-nav__brand" aria-label={brand.name}>
        <BrandLogo variant="brandmark" width={118} height={52} priority />
      </Link>

      <button
        type="button"
        className="site-nav__toggle"
        aria-expanded={open}
        aria-controls="site-nav-menu"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="site-nav__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div id="site-nav-menu" className="site-nav__links">
        {children}
      </div>

      {/* Dimming backdrop — only interactive on phones while the drawer is open. */}
      <button
        type="button"
        className="site-nav__scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
    </nav>
  );
}
