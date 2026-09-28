"use client";

/**
 * SchemesClient — interactive Schemes of Work admin panel.
 *
 * Two views, split by responsibility:
 *   list   → table of schemes + `SowUploadPanel` (upload state lives here via
 *            `useSowUpload` so a preview survives a hop into detail and back)
 *   detail → `SchemeDetailView` (inline row editing via `LessonEditForm`,
 *            add row, delete scheme) — this component loads/owns its data
 *
 * Mutations call server actions then call router.refresh() so the server
 * re-fetches and updates the initial props on next render.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { getScheme, deleteScheme } from "@/lib/actions/schemes";

import SchemeDetailView from "./SchemeDetailView";
import SowUploadPanel, { useSowUpload } from "./SowUploadPanel";
import type { SchemeDetail, SchemeRow, SowLesson } from "./types";
import styles from "./SchemesClient.module.css";

interface SchemesClientProps {
  initialSchemes: SchemeRow[];
}

export default function SchemesClient({ initialSchemes }: SchemesClientProps) {
  const t = useTranslations("lpManage.schemes");
  const router = useRouter();

  // Render the list straight from the server prop: router.refresh() re-renders
  // this component with fresh props but PRESERVES client state, so a useState
  // copy would never show a newly created/deleted scheme until a hard reload.
  const schemes = initialSchemes;
  const [view, setView] = useState<"list" | "detail">("list");
  const [detail, setDetail] = useState<SchemeDetail | null>(null);
  const [lessons, setLessons] = useState<SowLesson[]>([]);

  // Upload panel state (hook, so it survives the detail view unmounting the panel).
  const upload = useSowUpload();

  // Detail loading state
  const [detailPending, startDetailTransition] = useTransition();
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  // ── detail view ─────────────────────────────────────────────────────────────

  function openDetail(scheme: SchemeRow) {
    setDetailError(null);
    startDetailTransition(async () => {
      const result = await getScheme(scheme.id);
      if (!result.ok) {
        setDetailError(t("errorGeneric"));
        return;
      }
      setDetail({
        id: scheme.id,
        title: result.scheme?.title ?? scheme.title,
        grade: result.scheme?.grade ?? scheme.grade,
        subject: result.scheme?.subject ?? scheme.subject,
        term: result.scheme?.term ?? scheme.term,
        year: result.scheme?.year,
        mainCompetence: result.scheme?.mainCompetence,
        weeksCount: result.scheme?.weeksCount,
        lessonsPerWeek: result.scheme?.lessonsPerWeek,
        lessonDurationMins: result.scheme?.lessonDurationMins,
        totalLessons: result.scheme?.totalLessons,
        headerContext: result.scheme?.headerContext,
      });
      setLessons((result.lessons as SowLesson[]) ?? []);
      setView("detail");
    });
  }

  function handleLessonSaved() {
    if (!detail) return;
    startDetailTransition(async () => {
      const result = await getScheme(detail.id);
      if (result.ok) {
        setLessons((result.lessons as SowLesson[]) ?? []);
      }
    });
  }

  function handleDelete() {
    if (!detail) return;
    if (!confirm(t("deleteConfirm"))) return;
    startDeleteTransition(async () => {
      const result = await deleteScheme(detail.id);
      if (!result.ok) {
        setDetailError(t("errorGeneric"));
        return;
      }
      setView("list");
      setDetail(null);
      setLessons([]);
      router.refresh();
    });
  }

  // ── render: detail ──────────────────────────────────────────────────────────

  if (view === "detail" && detail) {
    return (
      <SchemeDetailView
        detail={detail}
        lessons={lessons}
        pending={detailPending}
        error={detailError}
        deletePending={deletePending}
        onBack={() => {
          setView("list");
          setDetail(null);
        }}
        onLessonSaved={handleLessonSaved}
        onDelete={handleDelete}
      />
    );
  }

  // ── render: list ────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      {/* Scheme list */}
      {schemes.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("columns.title")}</th>
                <th>{t("columns.grade")}</th>
                <th>{t("columns.subject")}</th>
                <th>{t("columns.term")}</th>
                <th>{t("columns.rows")}</th>
                <th>{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>{s.grade}</td>
                  <td>{s.subject}</td>
                  <td>{s.term}</td>
                  <td>{s.rowCount}</td>
                  <td>
                    <button
                      className={styles.btnSmall}
                      onClick={() => openDetail(s)}
                      disabled={detailPending}
                    >
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SowUploadPanel upload={upload} />
    </div>
  );
}
