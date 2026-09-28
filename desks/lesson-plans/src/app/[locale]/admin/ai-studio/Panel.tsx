"use client";

/**
 * Panel — a numbered, collapsible stepper card used for each input stage of the
 * AI Studio left column. The step badge flips to a "done" check once the stage
 * is satisfied; the summary line shows the current selection at a glance when
 * collapsed.
 */
import type { ReactNode } from "react";

import styles from "./Studio.module.css";

export default function Panel({
  step,
  title,
  summary,
  done,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  summary?: string;
  done?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = `studio-panel-${step}`;
  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={`${styles.panelHead} ${open ? styles.panelHeadOpen : ""}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span
          className={`${styles.stepBadge} ${done ? styles.stepBadgeDone : ""}`}
          aria-hidden="true"
        >
          {done ? "✓" : step}
        </span>
        <span className={styles.panelHeadText}>
          <span className={styles.panelTitle}>{title}</span>
          {summary ? <span className={styles.panelSummary}>{summary}</span> : null}
        </span>
        <span
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <path
              d="m5 8 5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={bodyId} className={styles.panelBody}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
