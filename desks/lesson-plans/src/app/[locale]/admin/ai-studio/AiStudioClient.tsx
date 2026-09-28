"use client";

/**
 * AI Studio (single-plan) — the v2 multi-panel Studio.
 *
 * Left column: three stacked stepper panels (Scheme & Lesson · Model & Prompt ·
 * Generate). Right column: a live, branded preview that fills
 * in as the structured plan streams, then renders the full `LessonPlanDocument`
 * once the draft satisfies the schema. Validation issues surface with a Repair
 * action; a structured editor lets the admin correct fields before Save/Publish.
 *
 * Streaming uses the documented manual-fetch fallback: we POST to
 * `/api/ai/generate` and progressively parse the partial JSON object with
 * `parsePartial` (lib/ai/lessonPlan/parsePartial).
 */
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { savePlanStructured } from "@/lib/actions/aiStudio";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";
import { applyKnownIdentifier } from "@/lib/ai/lessonPlan/identifier";
import { parsePartial } from "@/lib/ai/lessonPlan/parsePartial";
import { validateLessonPlan } from "@/lib/ai/lessonPlan/validate";

import Panel from "./Panel";
import SchemeLessonPanel, { type SchemeMode } from "./SchemeLessonPanel";
import StructuredEditor from "./StructuredEditor";
import PreviewPane from "./PreviewPane";
import { useStudioCatalogs } from "./useStudioCatalogs";
import {
  EMPTY_COLUMNS,
  type Draft,
  type LessonColumns,
  type PlanContext,
  type SchemeLessonRow,
  type SchemeSummary,
} from "./types";
import styles from "./Studio.module.css";

const TERM_OPTIONS = ["1a", "1b", "2a", "2b"] as const;

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `G${i + 1}`);

export default function AiStudioClient({
  apiKeyConfigured,
}: {
  apiKeyConfigured: boolean;
}) {
  const t = useTranslations("lpStudio");

  // ── Lists (shared bootstrap with the batch client) ──────────────────
  const { schemes, refreshSchemes } = useStudioCatalogs();

  // ── Panel 1: scheme & lesson ────────────────────────────────────────
  // `schemeMode` is lifted here (not local to the panel) so manual-entry text
  // survives the stepper unmounting Panel 1 when another step is opened.
  const [schemeMode, setSchemeMode] = useState<SchemeMode>("scheme");
  const [selectedScheme, setSelectedScheme] = useState<SchemeSummary | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<SchemeLessonRow | null>(null);
  const [columns, setColumns] = useState<LessonColumns>({ ...EMPTY_COLUMNS });

  // The model and prompts are no longer chosen here — they are admin settings
  // (AI Studio → Settings) and the route resolves them server-side.

  // ── Naming context ──────────────────────────────────────────────────
  const [ctx, setCtx] = useState<PlanContext>({
    grade: "G7",
    subject: "Math",
    term: "1a",
    week: "1",
    lesson: "1",
  });

  // ── Generation / preview ────────────────────────────────────────────
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Accordion (which left panel is open) ────────────────────────────
  const [openPanel, setOpenPanel] = useState<number>(1);
  const toggle = (n: number) => setOpenPanel((prev) => (prev === n ? 0 : n));

  // When a scheme is selected, mirror its grade/subject/term into the context.
  // Use `gradeNum` (not the raw `grade` label, e.g. "Grade 2") so the value
  // lines up with the `G<n>` tokens the Grade <select> actually offers —
  // otherwise the select silently falls back to its first option (G1) while
  // the real state holds an unmatched value.
  const handleSchemeSelect = useCallback((scheme: SchemeSummary | null) => {
    setSelectedScheme(scheme);
    if (scheme) {
      // `scheme.term` is free text from SOW parsing (usually "1a", but the
      // parser only strips a "Term " prefix, so e.g. "T2B" survives) — only
      // adopt it when it matches a TERM_OPTIONS token the Term <select>
      // offers, for the same reason as `gradeNum` above: an unmatched value
      // renders as the select's first option while save would reject it.
      const termToken = scheme.term.trim().toLowerCase();
      setCtx((prev) => ({
        ...prev,
        grade: scheme.gradeNum ? `G${scheme.gradeNum}` : prev.grade,
        subject: scheme.subject || prev.subject,
        term: (TERM_OPTIONS as readonly string[]).includes(termToken)
          ? termToken
          : prev.term,
      }));
    }
  }, []);

  const handleLessonSelect = useCallback((lesson: SchemeLessonRow | null) => {
    setSelectedLesson(lesson);
    if (lesson) {
      // `lessonNumber` is a free-text label as printed in the scheme (e.g.
      // "1", but sometimes messier like "L1 Wk2 · P1") — pull out the first
      // number rather than feeding raw text into the numeric Lesson input.
      const lessonDigits = lesson.lessonNumber?.match(/\d+/)?.[0];
      setCtx((prev) => ({
        ...prev,
        week: lesson.week != null ? String(lesson.week) : prev.week,
        lesson: lessonDigits ?? prev.lesson,
      }));
    }
  }, []);

  // ── Generate (with optional repair) ─────────────────────────────────
  const generate = useCallback(
    async (repairIssues?: string[]) => {
      setError(null);
      setNotice(null);
      setSavedSlug(null);
      if (!repairIssues) setDraft(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schemeLessonId: selectedLesson?.id,
            scheme: {
              grade: ctx.grade,
              subject: ctx.subject,
              term: ctx.term,
              week: ctx.week,
              lessonNumber: ctx.lesson,
              ...columns,
            },
            grade: ctx.grade,
            subject: ctx.subject,
            repairIssues,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = t("status.generationFailed");
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            /* non-JSON */
          }
          setError(message);
          return;
        }
        if (!res.body) {
          setError(t("status.noStream"));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const partial = parsePartial(accumulated);
          if (partial) setDraft(applyKnownIdentifier(partial, ctx));
        }
        accumulated += decoder.decode();
        const finalDraft = parsePartial(accumulated);
        if (finalDraft) setDraft(applyKnownIdentifier(finalDraft, ctx));
        // `streamObject` reports provider/model failures only via the server's
        // `onError` — the HTTP response is already a 200 text stream, so an
        // errored generation simply ends early. If the finished stream never
        // became a schema-valid plan, say so instead of leaving a preview
        // that silently never completes.
        if (!structuredLessonPlanSchema.safeParse(finalDraft ?? {}).success) {
          setError(t("status.generationIncomplete"));
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          setNotice(t("status.stopped"));
        } else {
          setError(t("status.generationFailed"));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [selectedLesson, ctx, columns, t],
  );

  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  const patchDraft = useCallback((patch: Draft) => {
    setDraft((prev) => ({ ...(prev ?? {}), ...patch }));
  }, []);

  // ── Validation ──────────────────────────────────────────────────────
  const parsed = draft ? structuredLessonPlanSchema.safeParse(draft) : null;
  const validPlan = parsed?.success ? parsed.data : null;
  const issues = validPlan ? validateLessonPlan(validPlan) : [];

  // ── Save / publish ──────────────────────────────────────────────────
  const handleSave = useCallback(
    async (publish: boolean) => {
      if (!validPlan) return;
      // Persisting a plan that still has validation issues is an explicit
      // admin decision — the server-side guard is only bypassed after this
      // confirm, never silently.
      if (
        issues.length > 0 &&
        !window.confirm(t("generate.confirmIssues", { count: issues.length }))
      ) {
        return;
      }
      setIsSaving(true);
      setError(null);
      setNotice(null);
      try {
        const res = await savePlanStructured(
          validPlan,
          {
            grade: ctx.grade,
            subject: ctx.subject,
            term: ctx.term,
            week: Number(ctx.week) || 1,
            lesson: Number(ctx.lesson) || 1,
            schemeLessonId: selectedLesson?.id,
          },
          { publish, ignoreValidation: issues.length > 0 },
        );
        if (!res.ok) {
          // `message` is the authored safe detail (e.g. validation issues).
          setError(res.message ?? t("status.saveFailed"));
          return;
        }
        setSavedSlug(res.slug ?? null);
        setNotice(publish ? t("status.published") : t("status.savedDraft"));
      } catch {
        setError(t("status.saveFailed"));
      } finally {
        setIsSaving(false);
      }
    },
    [validPlan, ctx, selectedLesson, issues.length, t],
  );

  // ── Panel summaries (collapsed state) ───────────────────────────────
  const schemeSummary = selectedLesson
    ? `${selectedScheme?.title ?? ""} · W${selectedLesson.week ?? "?"} L${selectedLesson.lessonNumber ?? "?"}`
    : selectedScheme?.title;

  // The preview column only appears once generation has started (or produced a
  // draft) — before that the stepper panels span the full width.
  const showPreview = isStreaming || !!draft;

  return (
    <div className={styles.studio}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{t("eyebrow")}</span>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </header>

      {!apiKeyConfigured && (
        <div className={styles.keyNotice} role="status">
          {t.rich("keyNotice", { code: (chunks) => <code>{chunks}</code> })}
        </div>
      )}

      <div className={`${styles.grid} ${showPreview ? styles.withPreview : ""}`}>
        {/* ── Left: stepper panels ─────────────────────────────────── */}
        <div className={styles.leftCol}>
          <Panel
            step={1}
            title={t("scheme.panelTitle")}
            summary={openPanel === 1 ? undefined : schemeSummary}
            done={!!selectedLesson || columns.specificCompetence.trim().length > 0}
            open={openPanel === 1}
            onToggle={() => toggle(1)}
          >
            <SchemeLessonPanel
              schemes={schemes}
              columns={columns}
              onColumnsChange={setColumns}
              selectedScheme={selectedScheme}
              onSchemeSelect={handleSchemeSelect}
              selectedLesson={selectedLesson}
              onLessonSelect={handleLessonSelect}
              onSchemeCreated={refreshSchemes}
              mode={schemeMode}
              onModeChange={setSchemeMode}
            />
          </Panel>

          <Panel
            step={2}
            title={t("generate.panelTitle")}
            done={!!validPlan}
            open={openPanel === 2}
            onToggle={() => toggle(2)}
          >
            <div className={styles.field}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>{t("ctx.grade")}</label>
                  <select
                    className={styles.select}
                    value={ctx.grade}
                    onChange={(e) => setCtx({ ...ctx, grade: e.target.value })}
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t("ctx.subject")}</label>
                  <input
                    className={styles.input}
                    value={ctx.subject}
                    onChange={(e) => setCtx({ ...ctx, subject: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>{t("ctx.term")}</label>
                  <select
                    className={styles.select}
                    value={ctx.term}
                    onChange={(e) => setCtx({ ...ctx, term: e.target.value })}
                  >
                    {TERM_OPTIONS.map((tm) => (
                      <option key={tm} value={tm}>
                        {tm.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t("ctx.week")}</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={ctx.week}
                    onChange={(e) => setCtx({ ...ctx, week: e.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>{t("ctx.lesson")}</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={ctx.lesson}
                    onChange={(e) => setCtx({ ...ctx, lesson: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              {isStreaming ? (
                <button type="button" className={styles.secondaryBtn} onClick={handleStop}>
                  {t("generate.stop")}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.generateBtn}`}
                  onClick={() => generate()}
                  disabled={!apiKeyConfigured}
                  title={apiKeyConfigured ? undefined : t("generate.disabledTitle")}
                >
                  {t("generate.generate")}
                </button>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {notice && <p className={styles.success}>{notice}</p>}
          </Panel>
        </div>

        {/* ── Right: live preview (only after generation starts) ───── */}
        {showPreview && (
        <div className={styles.rightCol}>
          <div className={styles.previewPanel}>
            <div className={styles.previewHead}>
              <span className={styles.previewHeadTitle}>
                {t("preview.heading")}
                {isStreaming && <span className={styles.statusDot} aria-hidden="true" />}
              </span>
            </div>
            <div className={styles.previewBody}>
              <PreviewPane draft={draft} isStreaming={isStreaming} />

              {/* Validation + Repair */}
              {validPlan && !isStreaming && (
                <div className={styles.validation}>
                  {issues.length === 0 ? (
                    <div className={styles.validationOk}>
                      <span aria-hidden="true">✓</span> {t("validation.passed")}
                    </div>
                  ) : (
                    <div className={styles.validationBad}>
                      <h3>{t("validation.issuesTitle", { count: issues.length })}</h3>
                      <ul className={styles.validationList}>
                        {issues.map((iss, i) => (
                          <li key={i}>{iss}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => generate(issues)}
                        disabled={isStreaming}
                      >
                        {t("validation.repair")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Structured editor */}
              {draft && !isStreaming && (
                <div style={{ marginTop: "0.9rem" }}>
                  <StructuredEditor draft={draft} onPatch={patchDraft} />
                </div>
              )}

              {/* Save / publish */}
              {validPlan && !isStreaming && (
                <div className={styles.saveBar}>
                  <div className={styles.saveActions}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => handleSave(false)}
                      disabled={isSaving}
                    >
                      {isSaving ? t("common.saving") : t("generate.saveDraft")}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => handleSave(true)}
                      disabled={isSaving}
                    >
                      {isSaving ? t("common.saving") : t("generate.publish")}
                    </button>
                  </div>
                  {savedSlug && (
                    <p className={styles.savedRef}>
                      {t("generate.savedAs")}{" "}
                      <Link
                        className={styles.savedLink}
                        href={`/plans/${savedSlug}`}
                      >
                        /plans/{savedSlug}
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
