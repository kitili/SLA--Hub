"use client";

/**
 * PlanVersionSwitch — lets a teacher read either version of the same lesson.
 *
 *   Lesson plan        the Silverleaf-branded booklet. Preview only.
 *   Government version the official form the school files. Downloadable.
 *
 * Both documents are rendered on the SERVER and handed in as `ReactNode` slots,
 * so none of their markup (nor the plan JSON, nor the form mapping) ships to the
 * client — this component only holds which slot is on screen. The one client
 * leaf inside the government slot is its download button.
 *
 * The chosen version is rendered and the other is UNMOUNTED, rather than hidden
 * with CSS: `PrintButton` resolves the document to capture by walking up to the
 * nearest `[data-print-root]` and falls back to the first one in the document
 * when that misses, so two mounted documents could hand it the wrong one.
 *
 * Tabs rather than a checkbox: two peer views of one thing, which is what the
 * tab pattern describes. Roving tabindex + arrow keys per WAI-ARIA.
 */
import { useRef, useState, type ReactNode } from "react";

import styles from "./plan.module.css";

type View = "branded" | "government";

const ORDER: View[] = ["branded", "government"];

export default function PlanVersionSwitch({
  groupLabel,
  brandedLabel,
  governmentLabel,
  branded,
  government,
}: {
  groupLabel: string;
  brandedLabel: string;
  governmentLabel: string;
  branded: ReactNode;
  government: ReactNode;
}) {
  const [view, setView] = useState<View>("branded");
  const tabs = useRef<Record<View, HTMLButtonElement | null>>({
    branded: null,
    government: null,
  });

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = ORDER[(ORDER.indexOf(view) + delta + ORDER.length) % ORDER.length]!;
    setView(next);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <div className={styles.versionTabs} role="tablist" aria-label={groupLabel}>
        {ORDER.map((value) => {
          const selected = view === value;
          return (
            <button
              key={value}
              ref={(node) => {
                tabs.current[value] = node;
              }}
              type="button"
              role="tab"
              id={`plan-version-${value}`}
              aria-selected={selected}
              aria-controls="plan-version-panel"
              tabIndex={selected ? 0 : -1}
              className={styles.versionTab}
              onClick={() => setView(value)}
              onKeyDown={onKeyDown}
            >
              {value === "branded" ? brandedLabel : governmentLabel}
            </button>
          );
        })}
      </div>

      <div
        id="plan-version-panel"
        role="tabpanel"
        aria-labelledby={`plan-version-${view}`}
        tabIndex={0}
      >
        {view === "branded" ? branded : government}
      </div>
    </>
  );
}
