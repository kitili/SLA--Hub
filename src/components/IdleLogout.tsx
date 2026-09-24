"use client";

/**
 * IdleLogout — signs the user out after a period of inactivity.
 *
 * Rendered (by the locale layout) only when a user is signed in. It watches for
 * user activity; after {@link IDLE_MS} of no interaction it ends the session via
 * the existing `signOutMemberAction` server action (which clears the httpOnly
 * cookie and redirects to /sign-in). A warning dialog with a live countdown
 * appears {@link WARN_MS} before logout, offering a "Stay signed in" button.
 *
 * This is the in-tab warning UX. The session cookie itself also expires
 * server-side after the same idle window (see `session-cookie.ts`); activity
 * here calls `touchSessionAction` so a long-lived tab stays signed in.
 *
 * Cross-tab: the last-activity timestamp is mirrored to localStorage, so a
 * `storage` event from another tab resets this tab's idle clock — a user
 * working in one tab won't be logged out of an idle one.
 *
 * Watching a video counts as activity (capture-phase `play`/`timeupdate`).
 * Returning to a background tab re-checks immediately so an expired session
 * does not wait for the next 1s tick.
 */

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { signOutMemberAction, touchSessionAction } from "@/lib/actions/member";
import styles from "./IdleLogout.module.css";

/**
 * Idle window before sign-out, and how long before that the warning shows.
 * Screen time defaults to 30 minutes, with a 1 minute warning. Tests can
 * shorten both via public env vars.
 */
const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS) || 30 * 60 * 1000;
const WARN_MS = Number(process.env.NEXT_PUBLIC_IDLE_WARN_MS) || 60 * 1000;
/** Shared key so activity in any tab resets the idle clock everywhere. */
const STORAGE_KEY = "sla:lastActivity";
/** Throttle activity writes to at most one per second. */
const ACTIVITY_THROTTLE_MS = 1000;
/** Slide the server session at most once a minute while the user is active. */
const TOUCH_THROTTLE_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

/** Media events don't bubble; listen in capture so watching a video counts. */
const MEDIA_EVENTS = ["play", "timeupdate"] as const;

export default function IdleLogout() {
  const t = useTranslations("idle");
  const [, startTransition] = useTransition();

  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARN_MS / 1000));

  // A fresh mount (page load / sign-in) counts as activity, so a stale
  // timestamp from a previous session never triggers an immediate logout.
  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  // Start "already touched" so the first mousemove doesn't POST; middleware
  // already slides the cookie on navigation, and we heartbeat every 60s after.
  const lastTouchRef = useRef(Date.now());
  const loggedOutRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  const logout = useCallback(() => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage may be unavailable (private mode); logout proceeds anyway.
    }
    startTransition(() => {
      void signOutMemberAction();
    });
  }, [startTransition]);

  const markActive = useCallback((persist: boolean) => {
    const now = Date.now();
    lastActivityRef.current = now;
    setWarning(false);
    if (persist && now - lastWriteRef.current >= ACTIVITY_THROTTLE_MS) {
      lastWriteRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // Ignore — cross-tab sync is best-effort.
      }
    }
    if (persist && now - lastTouchRef.current >= TOUCH_THROTTLE_MS) {
      lastTouchRef.current = now;
      void touchSessionAction();
    }
  }, []);

  // Activity listeners (passive — never blocks scrolling) + cross-tab sync.
  useEffect(() => {
    const onActivity = () => markActive(true);
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    for (const evt of MEDIA_EVENTS) {
      document.addEventListener(evt, onActivity, { capture: true, passive: true });
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const ts = Number(e.newValue);
      if (Number.isFinite(ts)) {
        lastActivityRef.current = ts;
        setWarning(false);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      for (const evt of MEDIA_EVENTS) {
        document.removeEventListener(evt, onActivity, { capture: true });
      }
      window.removeEventListener("storage", onStorage);
    };
  }, [markActive]);

  // Idle loop — fires logout, or surfaces the warning + countdown.
  // Also re-checks when a background tab is shown again so a stale session
  // does not linger until the next 1s tick.
  useEffect(() => {
    const tick = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_MS) {
        logout();
      } else if (idleFor >= IDLE_MS - WARN_MS) {
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_MS - idleFor) / 1000)));
      }
    };
    const id = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [logout]);

  // "Stay signed in" — explicit activity that dismisses the warning and
  // immediately slides the server session (don't wait for the 60s throttle).
  const stay = useCallback(() => {
    lastTouchRef.current = Date.now();
    void touchSessionAction();
    markActive(true);
  }, [markActive]);

  if (!warning) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <div className={styles.card}>
        <span className={styles.icon} role="img" aria-hidden="true">
          ⏳
        </span>
        <h2 id={titleId} className={styles.title}>
          {t("title")}
        </h2>
        <p id={bodyId} className={styles.body}>
          {t("message", { seconds: secondsLeft })}
        </p>
        <button type="button" className={styles.stay} onClick={stay} autoFocus>
          {t("stay")}
        </button>
      </div>
    </div>
  );
}
