"use client";

/**
 * PreviewPane — the right column. Three states:
 *  1. idle        → a tasteful placeholder
 *  2. streaming   → a shimmer skeleton + any partial sections that have arrived
 *  3. valid draft → the branded `LessonPlanDocument`
 *
 * `LessonPlanDocument` and its `PrintButton` are plain presentational
 * components (no server-only imports, no server APIs) so they render fine inside
 * this client component.
 */
import { useTranslations } from "next-intl";

import LessonPlanDocument from "@/components/lesson/document/LessonPlanDocument";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";

import type { Draft } from "./types";
import styles from "./Studio.module.css";

export default function PreviewPane({
  draft,
  isStreaming,
}: {
  draft: Draft | null;
  isStreaming: boolean;
}) {
  const t = useTranslations("lpStudio");

  const parsed = draft ? structuredLessonPlanSchema.safeParse(draft) : null;
  const valid = parsed?.success ? parsed.data : null;

  // Idle.
  if (!draft && !isStreaming) {
    return (
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <rect
              x="12"
              y="8"
              width="40"
              height="48"
              rx="4"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              d="M20 22h24M20 32h24M20 42h16"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className={styles.placeholderText}>{t("preview.placeholder")}</p>
      </div>
    );
  }

  // Valid → branded document.
  if (valid && !isStreaming) {
    return (
      <div className={styles.docScroll}>
        {/* Studio is the one surface that still exports the branded PDF; the
            teacher plan page deliberately does not (it offers the government
            form instead), so the export is opt-in. */}
        <LessonPlanDocument plan={valid} showPrint />
      </div>
    );
  }

  // Streaming (or partial-but-not-yet-valid) → skeleton + partial sections.
  return (
    <div className={styles.streamState}>
      <div className={styles.streamHeader}>
        <span className={styles.statusDot} aria-hidden="true" />
        {t("preview.composing")}
      </div>

      {/* Partial sections that have already streamed in. */}
      {draft && (
        <div className={styles.partialSections}>
          {draft.identifier?.title && (
            <Section title={t("preview.sectionTitle")} body={draft.identifier.title} />
          )}
          {draft.success_criteria && draft.success_criteria.length > 0 && (
            <Section
              title={t("preview.sectionSuccess")}
              body={draft.success_criteria.join(" · ")}
            />
          )}
          {draft.knows && draft.knows.length > 0 && (
            <Section title={t("preview.sectionKnows")} body={draft.knows.join(" · ")} />
          )}
          {draft.teaching_sequence?.i_do?.text && (
            <Section
              title={t("preview.sectionTeaching")}
              body={draft.teaching_sequence.i_do.text}
            />
          )}
        </div>
      )}

      {/* Shimmer skeleton for not-yet-arrived content. */}
      <div className={styles.streamBars}>
        {[92, 78, 85, 64, 88, 72].map((w, i) => (
          <div key={i} className={styles.skelBar} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.partialSection}>
      <div className={styles.partialSectionTitle}>{title}</div>
      <div className={styles.partialSectionBody}>{body}</div>
    </div>
  );
}
