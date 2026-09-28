"use client";

import { useRouter } from "next/navigation";

import styles from "./plan.module.css";

/**
 * Back control for the plan preview.
 *
 * Returns the teacher to wherever they came from (search results, dashboard,
 * upcoming lessons). Uses browser history when there is somewhere to go back
 * to, and otherwise falls back to the dashboard so the button is never a
 * dead end (e.g. when the plan is opened from a fresh tab or a shared link).
 */
export default function BackButton({
  label,
  fallbackHref,
}: {
  label: string;
  fallbackHref: string;
}) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" className={styles.backButton} onClick={handleClick}>
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
