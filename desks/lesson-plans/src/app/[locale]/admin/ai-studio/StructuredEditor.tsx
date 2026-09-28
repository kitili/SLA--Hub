"use client";

/**
 * StructuredEditor — a collapsible editor for correcting key fields of the
 * generated `StructuredLessonPlan` draft. Edits are reflected live in the
 * branded preview. Array fields (success_criteria, knows, shows, materials,
 * teacher_reflection) are edited as newline-delimited textareas; each teaching
 * stage exposes its text + checkpoint; differentiation tiers and the assessment
 * method are single fields.
 *
 * The editor is deliberately partial-tolerant: it reads from a possibly
 * incomplete draft and writes patches the parent merges into the draft.
 */
import { useTranslations } from "next-intl";

import { TEACHING_STAGES } from "@/lib/ai/lessonPlan/structuredSchema";

import type { Draft } from "./types";
import styles from "./Studio.module.css";

type StageKey = (typeof TEACHING_STAGES)[number]["key"];

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function StructuredEditor({
  draft,
  onPatch,
}: {
  draft: Draft;
  onPatch: (patch: Draft) => void;
}) {
  const t = useTranslations("lpStudio");

  const setIdentifierTitle = (title: string) =>
    onPatch({
      identifier: { ...(draft.identifier ?? ({} as never)), title },
    });

  const setStage = (key: StageKey, field: "text" | "checkpoint", value: string) => {
    const seq = draft.teaching_sequence ?? ({} as NonNullable<Draft["teaching_sequence"]>);
    const stage = (seq[key] ?? {}) as Record<string, unknown>;
    onPatch({
      teaching_sequence: {
        ...seq,
        [key]: { ...stage, [field]: value },
      } as NonNullable<Draft["teaching_sequence"]>,
    });
  };

  const setDiff = (
    field: "remedial" | "support" | "challenge",
    value: string,
  ) => {
    const d = draft.differentiation ?? ({} as NonNullable<Draft["differentiation"]>);
    onPatch({
      differentiation: { ...d, [field]: value } as NonNullable<Draft["differentiation"]>,
    });
  };

  return (
    <details className={styles.accordion}>
      <summary className={styles.accordionHead}>{t("editor.title")}</summary>
      <div className={styles.accordionBody}>
        <div className={styles.editorGrid}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>{t("editor.lessonTitle")}</label>
            <input
              className={styles.input}
              value={draft.identifier?.title ?? ""}
              onChange={(e) => setIdentifierTitle(e.target.value)}
            />
          </div>

          {/* Array fields */}
          {(
            [
              ["success_criteria", t("editor.successCriteria")],
              ["knows", t("editor.knows")],
              ["shows", t("editor.shows")],
              ["materials_and_prep", t("editor.materials")],
              ["teacher_reflection", t("editor.reflection")],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className={styles.field}>
              <label className={styles.label}>
                {label} <span className={styles.hint}>{t("editor.onePerLine")}</span>
              </label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={((draft[key] as string[] | undefined) ?? []).join("\n")}
                onChange={(e) => onPatch({ [key]: linesToArray(e.target.value) } as Draft)}
              />
            </div>
          ))}

          {/* Teaching stages */}
          {TEACHING_STAGES.map(({ key, label }) => {
            const stage = draft.teaching_sequence?.[key];
            return (
              <div key={key} className={styles.editorStage}>
                <span className={styles.editorStageTitle}>{label}</span>
                <div className={styles.field}>
                  <label className={styles.label}>{t("editor.stageText")}</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={stage?.text ?? ""}
                    onChange={(e) => setStage(key, "text", e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t("editor.checkpoint")}</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={stage?.checkpoint ?? ""}
                    onChange={(e) => setStage(key, "checkpoint", e.target.value)}
                  />
                </div>
              </div>
            );
          })}

          {/* Differentiation */}
          {(["remedial", "support", "challenge"] as const).map((field) => (
            <div key={field} className={styles.field}>
              <label className={styles.label}>{t(`editor.diff_${field}`)}</label>
              <textarea
                className={styles.textarea}
                rows={2}
                value={draft.differentiation?.[field] ?? ""}
                onChange={(e) => setDiff(field, e.target.value)}
              />
            </div>
          ))}

          {/* Assessment method */}
          <div className={styles.field}>
            <label className={styles.label}>{t("editor.assessmentMethod")}</label>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft.assessment_method ?? ""}
              onChange={(e) => onPatch({ assessment_method: e.target.value })}
            />
          </div>
        </div>
      </div>
    </details>
  );
}
