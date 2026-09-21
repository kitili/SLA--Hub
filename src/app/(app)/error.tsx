"use client";

import Link from "next/link";
import styles from "@/components/hub.module.css";

export default function ErrorView({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.blankCard}>
      <p className={styles.eyebrow}>Something went wrong</p>
      <h1>This desk hit a snag</h1>
      <p>Try again, or go back to the hub home and pick another department.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          Try again
        </button>
        <Link className={styles.secondary} href="/hub">
          Back to hub
        </Link>
      </div>
    </div>
  );
}
