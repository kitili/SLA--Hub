"use client";

/**
 * SchemeDetailView — one scheme's sow_lessons with inline row editing, an
 * add-row form, and the delete-scheme danger zone. Data loading stays in
 * SchemesClient (which owns `detail`/`lessons`); this view only owns which
 * row is being edited — that selection intentionally resets when the admin
 * leaves the detail view (the component unmounts).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import HeaderContextPanel from "./HeaderContextPanel";
import LessonEditForm from "./LessonEditForm";
import SchemeMetaSummary from "./SchemeMetaSummary";
import type { SchemeDetail, SowLesson } from "./types";
import styles from "./SchemesClient.module.css";

export default function SchemeDetailView({
  detail,
  lessons,
  pending,
  error,
  deletePending,
  onBack,
  onLessonSaved,
  onDelete,
}: {
  detail: SchemeDetail;
  lessons: SowLesson[];
  /** True while the parent re-fetches the lesson list. */
  pending: boolean;
  error: string | null;
  deletePending: boolean;
  onBack: () => void;
  /** Parent re-fetches `lessons` after a row is saved. */
  onLessonSaved: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("lpManage.schemes");
  // Canonical SOW column labels (shared with the Studio panels).
  const tCols = useTranslations("lpStudio.scheme.columns");
  const [editingLesson, setEditingLesson] = useState<SowLesson | null | "new">(null);

  function handleSaved() {
    setEditingLesson(null);
    onLessonSaved();
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.backLink} onClick={onBack}>
        {t("backToList")}
      </button>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>{detail.title}</h2>
        <p className={styles.meta}>
          {detail.grade} · {detail.subject} · {t("metaTerm")} {detail.term}
          {detail.year ? ` · ${detail.year}` : ""}
        </p>
        <SchemeMetaSummary meta={detail} />
        <HeaderContextPanel ctx={detail.headerContext} />

        {error ? <p className={styles.error}>{error}</p> : null}

        {pending ? (
          <p className={styles.muted}>{t("saving")}</p>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{tCols("week")}</th>
                    <th>{tCols("lessonNumber")}</th>
                    <th>{tCols("specificCompetence")}</th>
                    <th>{tCols("mainActivity")}</th>
                    <th>{tCols("lessonObjective")}</th>
                    <th>{t("columns.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((l) => (
                    <tr key={l.id}>
                      {editingLesson && typeof editingLesson !== "string" && editingLesson.id === l.id ? (
                        <td colSpan={6}>
                          <LessonEditForm
                            lesson={l}
                            schemeId={detail.id}
                            nextIndex={l.orderIndex}
                            onSaved={handleSaved}
                            onCancel={() => setEditingLesson(null)}
                          />
                        </td>
                      ) : (
                        <>
                          <td>{l.week ?? "—"}</td>
                          <td>{l.lessonNumber ?? "—"}</td>
                          <td className={styles.cellClamp}>{l.specificCompetence ?? "—"}</td>
                          <td className={styles.cellClamp}>{l.mainActivity ?? "—"}</td>
                          <td className={styles.cellClamp}>{l.lessonObjective ?? "—"}</td>
                          <td>
                            <button
                              className={styles.btnSmall}
                              onClick={() => setEditingLesson(l)}
                            >
                              {t("edit")}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {lessons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyCell}>
                        {t("empty")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {editingLesson === "new" ? (
              <LessonEditForm
                lesson={null}
                schemeId={detail.id}
                nextIndex={lessons.length}
                onSaved={handleSaved}
                onCancel={() => setEditingLesson(null)}
              />
            ) : (
              <button
                className={styles.btnSecondary}
                onClick={() => setEditingLesson("new")}
              >
                {t("addRow")}
              </button>
            )}
          </>
        )}

        <div className={styles.dangerZone}>
          <button
            className={styles.btnDanger}
            onClick={onDelete}
            disabled={deletePending}
          >
            {deletePending ? t("deleting") : t("deleteButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
