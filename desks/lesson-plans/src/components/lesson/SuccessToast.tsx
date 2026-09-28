"use client";

/**
 * SuccessToast — a lightweight, auto-dismissing success banner.
 *
 * Used after a feedback submission to celebrate the award ("+15 points!").
 * Accessible: `role="status"` + `aria-live="polite"` so screen readers
 * announce it without stealing focus. Auto-dismisses after a few seconds, and
 * can be dismissed manually. Honours `prefers-reduced-motion` via CSS.
 */
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import styles from "./SuccessToast.module.css";

export interface SuccessToastProps {
  /** Headline message, e.g. "Thanks for your feedback!". */
  message: string;
  /** Points awarded by the action; renders a "+N points" flourish when > 0. */
  points?: number;
  /** Auto-dismiss delay in ms (default 4000). */
  durationMs?: number;
}

export default function SuccessToast({
  message,
  points,
  durationMs = 4000,
}: SuccessToastProps) {
  const t = useTranslations("lpFeedback");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.check} aria-hidden="true">
        ✓
      </span>
      <span className={styles.message}>{message}</span>
      {typeof points === "number" && points > 0 && (
        <span className={styles.points}>{t("toast.points", { points })}</span>
      )}
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setVisible(false)}
        aria-label={t("toast.dismiss")}
      >
        ×
      </button>
    </div>
  );
}
