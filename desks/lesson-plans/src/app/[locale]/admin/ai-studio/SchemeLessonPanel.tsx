"use client";

/**
 * Panel 1 — Scheme & Lesson.
 *
 * Pick a scheme of work (or upload one), then precisely pick a lesson row from
 * it. The chosen row's 10 columns become editable local overrides used for
 * generation; edits can optionally be persisted back to the scheme. A manual
 * mode lets the admin author a blank row when no scheme/row fits.
 */
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import {
  createSchemeFromUpload,
  getScheme,
  previewSowUpload,
  upsertSowLesson,
  type SowUploadInput,
} from "@/lib/actions/schemes";

import RecordPicker from "./RecordPicker";
import SowPreviewTable, { type SowPreviewRow } from "./SowPreviewTable";
import { fileToSowUploadInput } from "./sowUpload";
import {
  EMPTY_COLUMNS,
  LESSON_COLUMN_KEYS,
  type LessonColumns,
  type SchemeLessonRow,
  type SchemeSummary,
} from "./types";
import styles from "./Studio.module.css";

export type SchemeMode = "scheme" | "manual";

export default function SchemeLessonPanel({
  schemes,
  columns,
  onColumnsChange,
  selectedScheme,
  onSchemeSelect,
  selectedLesson,
  onLessonSelect,
  onSchemeCreated,
  mode,
  onModeChange,
}: {
  schemes: SchemeSummary[];
  columns: LessonColumns;
  onColumnsChange: (cols: LessonColumns) => void;
  selectedScheme: SchemeSummary | null;
  onSchemeSelect: (scheme: SchemeSummary | null) => void;
  selectedLesson: SchemeLessonRow | null;
  onLessonSelect: (lesson: SchemeLessonRow | null) => void;
  /** Called after a successful upload so the parent can refresh the scheme list. */
  onSchemeCreated: () => void;
  /** Scheme-vs-manual entry mode — lifted to the parent so it survives the
   *  panel unmounting when the stepper collapses this step. */
  mode: SchemeMode;
  onModeChange: (mode: SchemeMode) => void;
}) {
  const t = useTranslations("lpStudio");
  const [lessons, setLessons] = useState<SchemeLessonRow[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [weekFilter, setWeekFilter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Upload-review state.
  const [previewRows, setPreviewRows] = useState<SowPreviewRow[] | null>(null);
  const [pendingUpload, setPendingUpload] = useState<SowUploadInput | null>(null);

  const applyRow = useCallback(
    (row: SchemeLessonRow) => {
      onLessonSelect(row);
      const next: LessonColumns = { ...EMPTY_COLUMNS };
      for (const key of LESSON_COLUMN_KEYS) {
        next[key] = (row[key] as string) ?? "";
      }
      onColumnsChange(next);
    },
    [onLessonSelect, onColumnsChange],
  );

  const loadLessons = useCallback(
    async (schemeId: string, autoSelectFirst = false) => {
      setLoadingLessons(true);
      setErr(null);
      const res = await getScheme(schemeId);
      setLoadingLessons(false);
      if (!res.ok || !res.lessons) {
        setErr(t("scheme.loadError"));
        setLessons([]);
        return;
      }
      const mapped: SchemeLessonRow[] = res.lessons.map((l) => ({
        id: l.id,
        orderIndex: l.orderIndex,
        week: l.week,
        lessonNumber: l.lessonNumber,
        specificCompetence: l.specificCompetence ?? "",
        mainActivity: l.mainActivity ?? "",
        lessonObjective: l.lessonObjective ?? "",
        knowledgeAndSkills: l.knowledgeAndSkills ?? "",
        assessmentEvidence: l.assessmentEvidence ?? "",
        learningActivities: l.learningActivities ?? "",
        misconceptions: l.misconceptions ?? "",
        differentiationSupport: l.differentiationSupport ?? "",
        resources: l.resources ?? "",
        reflection: l.reflection ?? "",
      }));
      setLessons(mapped);
      // Pre-fill the rest of the studio (week / lesson / columns) from the
      // scheme's first row so a single scheme pick populates Generate & Save.
      if (autoSelectFirst && mapped[0]) applyRow(mapped[0]);
    },
    [t, applyRow],
  );

  const handleSchemeChange = useCallback(
    (scheme: SchemeSummary | null) => {
      onSchemeSelect(scheme);
      onLessonSelect(null);
      setLessons([]);
      setWeekFilter("");
      if (scheme) void loadLessons(scheme.id, true);
    },
    [onSchemeSelect, onLessonSelect, loadLessons],
  );

  const updateColumn = useCallback(
    (key: keyof LessonColumns, value: string) => {
      onColumnsChange({ ...columns, [key]: value });
    },
    [columns, onColumnsChange],
  );

  // ── File upload ───────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      setErr(null);
      setNotice(null);
      setPreviewRows(null);
      try {
        const payload = await fileToSowUploadInput(file);
        setPendingUpload(payload);
        setBusy(true);
        const res = await previewSowUpload(payload);
        setBusy(false);
        if (!res.ok || !res.rows) {
          setErr(t("scheme.previewError"));
          return;
        }
        setPreviewRows(res.rows);
      } catch {
        setBusy(false);
        setErr(t("scheme.previewError"));
      }
    },
    [t],
  );

  const confirmUpload = useCallback(async () => {
    if (!pendingUpload) return;
    setBusy(true);
    setErr(null);
    const res = await createSchemeFromUpload(pendingUpload);
    setBusy(false);
    if (!res.ok) {
      // Show the authored safe detail when present (e.g. which scheme meta
      // fields the file is missing) — see docs/server-actions.md rule 3.
      setErr(res.message ?? t("scheme.createError"));
      return;
    }
    setNotice(t("scheme.created", { count: res.rowCount ?? 0 }));
    setPreviewRows(null);
    setPendingUpload(null);
    onSchemeCreated();
    if (res.schemeId) {
      // Pre-select the newly created scheme.
      void loadLessons(res.schemeId);
    }
  }, [pendingUpload, t, onSchemeCreated, loadLessons]);

  // ── Save edits back to the scheme ─────────────────────────────────────
  const saveToScheme = useCallback(async () => {
    if (!selectedScheme || !selectedLesson) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await upsertSowLesson({
      id: selectedLesson.id,
      schemeId: selectedScheme.id,
      orderIndex: selectedLesson.orderIndex,
      week: selectedLesson.week,
      lessonNumber: selectedLesson.lessonNumber,
      ...columns,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t("scheme.saveRowError"));
      return;
    }
    setNotice(t("scheme.savedRow"));
  }, [selectedScheme, selectedLesson, columns, t]);

  // Filtered lessons by week.
  const filteredLessons = weekFilter
    ? lessons.filter((l) => String(l.week ?? "") === weekFilter)
    : lessons;

  const weekOptions = Array.from(
    new Set(lessons.map((l) => l.week).filter((w): w is number => w != null)),
  ).sort((a, b) => a - b);

  return (
    <>
      <div className={styles.segment} role="tablist" aria-label={t("scheme.modeAria")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "scheme"}
          className={`${styles.segmentBtn} ${mode === "scheme" ? styles.segmentBtnActive : ""}`}
          onClick={() => onModeChange("scheme")}
        >
          {t("scheme.modeScheme")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`${styles.segmentBtn} ${mode === "manual" ? styles.segmentBtnActive : ""}`}
          onClick={() => {
            onModeChange("manual");
            onSchemeSelect(null);
            onLessonSelect(null);
            onColumnsChange({ ...EMPTY_COLUMNS });
          }}
        >
          {t("scheme.modeManual")}
        </button>
      </div>

      {mode === "scheme" && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="studio-scheme">
              {t("scheme.selectLabel")}
            </label>
            <RecordPicker<SchemeSummary>
              items={schemes}
              selectedKey={selectedScheme?.id ?? null}
              getKey={(s) => s.id}
              getPrimary={(s) => `${s.title} (${s.rowCount})`}
              getSecondary={(s) =>
                `${s.grade} · ${s.subject} · ${s.term.toUpperCase()}`
              }
              filterText={(s) =>
                `${s.title} ${s.grade} ${s.subject} ${s.term}`
              }
              onSelect={handleSchemeChange}
              placeholder={t("scheme.searchPlaceholder")}
              emptyLabel={t("scheme.noSchemes")}
            />
          </div>

          {/* Upload SOW */}
          <details className={styles.accordion}>
            <summary className={styles.accordionHead}>{t("scheme.uploadTitle")}</summary>
            <div className={styles.accordionBody}>
              <p className={styles.muted}>{t("scheme.uploadHint")}</p>
              <input
                type="file"
                accept=".docx,.csv"
                className={styles.input}
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              {previewRows && (
                <>
                  <SowPreviewTable
                    rows={previewRows}
                    classNames={{
                      wrapper: styles.reviewWrap,
                      table: styles.reviewTable,
                    }}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={confirmUpload}
                      disabled={busy}
                    >
                      {busy ? t("common.saving") : t("scheme.confirmUpload", { count: previewRows.length })}
                    </button>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => {
                        setPreviewRows(null);
                        setPendingUpload(null);
                      }}
                      disabled={busy}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </details>

          {/* Lesson row picker */}
          {selectedScheme && (
            <div className={styles.field}>
              <label className={styles.label}>{t("scheme.pickLessonLabel")}</label>
              {weekOptions.length > 0 && (
                <select
                  className={styles.select}
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                  aria-label={t("scheme.weekFilter")}
                >
                  <option value="">{t("scheme.allWeeks")}</option>
                  {weekOptions.map((w) => (
                    <option key={w} value={String(w)}>
                      {t("scheme.weekN", { week: w })}
                    </option>
                  ))}
                </select>
              )}
              {loadingLessons ? (
                <p className={styles.muted}>{t("common.loading")}</p>
              ) : (
                <RecordPicker<SchemeLessonRow>
                  items={filteredLessons}
                  selectedKey={selectedLesson?.id ?? null}
                  getKey={(l) => l.id}
                  getPrimary={(l) =>
                    `W${l.week ?? "?"} · L${l.lessonNumber ?? "?"} · ${
                      l.specificCompetence || t("scheme.untitledRow")
                    }`
                  }
                  getSecondary={(l) => l.lessonObjective || null}
                  filterText={(l) =>
                    `${l.week ?? ""} ${l.lessonNumber ?? ""} ${l.specificCompetence ?? ""} ${l.lessonObjective ?? ""}`
                  }
                  onSelect={applyRow}
                  emptyLabel={t("scheme.noLessons")}
                />
              )}
            </div>
          )}

          {selectedLesson && (
            <div className={styles.summaryCard}>
              <span className={styles.summaryLead}>{t("scheme.selectedRow")}</span>
              <span className={styles.summaryTitle}>
                {selectedLesson.specificCompetence || t("scheme.untitledRow")}
              </span>
              <span className={styles.summaryMeta}>
                {t("scheme.weekN", { week: selectedLesson.week ?? "?" })} ·{" "}
                {t("scheme.lessonN", { lesson: selectedLesson.lessonNumber ?? "?" })}
              </span>
            </div>
          )}
        </>
      )}

      {/* Editable columns — shown for both modes once a row exists or manual mode */}
      {(mode === "manual" || selectedLesson) && (
        <details className={styles.accordion} open={mode === "manual"}>
          <summary className={styles.accordionHead}>
            <span>{t("scheme.columnsTitle")}</span>
            <span className={styles.chevron} aria-hidden="true">
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
          </summary>
          <div className={styles.accordionBody}>
            {LESSON_COLUMN_KEYS.map((key) => (
              <div key={key} className={styles.field}>
                <label className={styles.label} htmlFor={`col-${key}`}>
                  {t(`scheme.columns.${key}`)}
                </label>
                <textarea
                  id={`col-${key}`}
                  className={styles.textarea}
                  rows={2}
                  value={columns[key]}
                  onChange={(e) => updateColumn(key, e.target.value)}
                />
              </div>
            ))}
            {mode === "scheme" && selectedScheme && selectedLesson && (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={saveToScheme}
                disabled={busy}
              >
                {t("scheme.saveToScheme")}
              </button>
            )}
          </div>
        </details>
      )}

      {err && <p className={styles.error}>{err}</p>}
      {notice && <p className={styles.success}>{notice}</p>}
    </>
  );
}
