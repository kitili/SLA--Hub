"use client";

/**
 * AdminNavLink — the "Admin" entry in the top nav.
 *
 * The link is visible to everyone, but the `/admin` subtree is gated server-side
 * (see `app/[locale]/admin/layout.tsx`), which silently redirects non-admins back
 * to the hub. That silent bounce is confusing, so when the current user is NOT an
 * admin we intercept the click and show a small explanation modal instead of
 * navigating. Admins get a normal locale-aware link.
 *
 * This is UX only — the server gate remains the real access control.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import styles from "./AdminNavLink.module.css";

export interface AdminNavLinkProps {
  /** Whether the current user has admin access (false when signed out too). */
  isAdmin: boolean;
}

export default function AdminNavLink({ isAdmin }: AdminNavLinkProps) {
  const tNav = useTranslations("nav");
  const tGate = useTranslations("adminGate");
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // While the modal is open: close on Escape and move focus to the dismiss
  // button so keyboard users land inside the dialog.
  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Admins get a normal navigating link.
  if (isAdmin) {
    return <Link href="/admin">{tNav("admin")}</Link>;
  }

  return (
    <>
      <button
        type="button"
        className={styles.navLink}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {tNav("admin")}
      </button>

      {open && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onClick={() => setOpen(false)}
        >
          {/* Stop backdrop clicks that land on the card from closing it. */}
          <div className={styles.card} onClick={(e) => e.stopPropagation()}>
            <span className={styles.icon} role="img" aria-hidden="true">
              🔒
            </span>
            <h2 id={titleId} className={styles.title}>
              {tGate("title")}
            </h2>
            <p id={bodyId} className={styles.body}>
              {tGate("body")}
            </p>
            <button
              ref={closeRef}
              type="button"
              className={styles.dismiss}
              onClick={() => setOpen(false)}
            >
              {tGate("dismiss")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
