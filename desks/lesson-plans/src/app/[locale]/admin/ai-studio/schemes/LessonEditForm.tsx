"use client";

/**
 * LessonEditForm — inline add/edit form for one sow_lessons row.
 *
 * The 10 SOW content columns render from the shared `LESSON_COLUMN_KEYS`
 * metadata (the same source SchemeLessonPanel maps over) so this form can
 * never drift from the canonical column set; week / lessonNumber keep their
 * own inputs because they differ in kind (number vs free-text coordinate).
 */
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { upsertSowLesson, type UpsertSowLessonInput } from "@/lib/actions/schemes";

import {
  EMPTY_COLUMNS,
  LESSON_COLUMN_KEYS,
  type LessonColumns,
} from "../types";
import type { SowLesson } from "./types";
import styles from "./SchemesClient.module.css";

export default function LessonEditForm({
  lesson,
  schemeId,
  nextIndex,
  onSaved,
  onCancel,
}: {
  lesson: Partial<SowLesson> | null;
  schemeId: string;
  nextIndex: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("lpManage.schemes");
  // Canonical SOW column labels (shared with the Studio panels).
  const tCols = useTranslations("lpStudio.scheme.columns");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isNew = !lesson?.id;

  const [week, setWeek] = useState(String(lesson?.week ?? ""));
  const [lessonNumber, setLessonNumber] = useState(lesson?.lessonNumber ?? "");
  const [columns, setColumns] = useState<LessonColumns>(() => {
    const initial = { ...EMPTY_COLUMNS };
    for (const key of LESSON_COLUMN_KEYS) initial[key] = lesson?.[key] ?? "";
    return initial;
  });

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const input: UpsertSowLessonInput = {
        id: lesson?.id,
        schemeId,
        orderIndex: lesson?.orderIndex ?? nextIndex,
        week: week ? Number(week) : null,
        lessonNumber: lessonNumber || null,
      };
      for (const key of LESSON_COLUMN_KEYS) input[key] = columns[key] || null;
      const result = await upsertSowLesson(input);
      if (result.ok) {
        onSaved();
      } else {
        setError(t("errorGeneric"));
      }
    });
  }

  return (
    <div className={styles.editForm}>
      <div className={styles.editRow}>
        <label className={styles.fieldLabel}>
          {tCols("week")}
          <input
            className={styles.input}
            type="number"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className={styles.fieldLabel}>
          {tCols("lessonNumber")}
          <input
            className={styles.input}
            type="text"
            value={lessonNumber}
            onChange={(e) => setLessonNumber(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>
      {LESSON_COLUMN_KEYS.map((key) => (
        <label key={key} className={styles.fieldLabel}>
          {tCols(key)}
          <textarea
            className={styles.textarea}
            value={columns[key]}
            onChange={(e) =>
              setColumns((prev) => ({ ...prev, [key]: e.target.value }))
            }
            rows={key === "learningActivities" ? 3 : 2}
            disabled={pending}
          />
        </label>
      ))}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.formActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? t("saving") : isNew ? t("addRow") : t("save")}
        </button>
        <button
          className={styles.btnSecondary}
          onClick={onCancel}
          disabled={pending}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
