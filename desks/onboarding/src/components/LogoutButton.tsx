"use client";

/**
 * LogoutButton — header control that ends the session and returns the user to
 * the sign-in page.
 *
 * Delegates to the `signOutMemberAction` server action, which clears the
 * httpOnly session cookie and then `redirect`s to `/sign-in` (the locale
 * middleware adds the active locale prefix). Doing the redirect server-side
 * avoids any client-router race and guarantees the post-logout page reflects
 * the cleared session. `useTransition` disables the button while in flight.
 */

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { signOutMemberAction } from "@/lib/actions/member";

export default function LogoutButton() {
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();

  function onLogout() {
    startTransition(async () => {
      await signOutMemberAction();
    });
  }

  return (
    <button
      type="button"
      className="site-nav__logout"
      onClick={onLogout}
      disabled={pending}
      aria-label={t("signOut")}
      title={t("signOut")}
    >
      {/* Inline log-out glyph (no icon dependency in this app yet). */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {/* Visible only inside the mobile drawer; icon-only on desktop. */}
      <span className="site-nav__logout-label">{t("signOut")}</span>
    </button>
  );
}
