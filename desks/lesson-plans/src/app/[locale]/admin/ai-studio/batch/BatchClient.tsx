"use client";

/**
 * AI Studio batch client — pick a scheme of work, choose which of its lessons to
 * generate, and run them through a FOREGROUND bounded-concurrency pool.
 *
 * Flow:
 *  1. Pick a scheme (`listSchemes` → `getScheme` loads its SOW lessons).
 *  2. Tick the lessons to generate (default: all).
 *  3. Choose how many to run in parallel (default 4), optionally tweak the model
 *     or prompt parts.
 *  4. Generate: a pool of N workers each call `POST /api/ai/batch/lesson` once per
 *     lesson, reusing the exact v2 single-generation pipeline. Each plan is saved
 *     as a draft. Failed items retry with back-off; one failure never sinks the
 *     batch. Progress is tracked live in React state (this is foreground — keep
 *     the tab open). A single `ai_generations` row records the run for history.
 *
 * Why a client-driven pool: each `/api/ai/batch/lesson` call is one short request
 * (~15–40s), safe under serverless limits, and reuses the proven save path, so a
 * batch plan is byte-for-byte what the single-plan Studio produces.
 *
 * The engine (per-lesson retry/back-off + the worker pool + tally) lives in
 * `./batchPool` — this component owns selection, config, audit rows, and the
 * progress rendering.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { getScheme } from "@/lib/actions/schemes";
import { startBatchRun, finishBatchRun } from "@/lib/actions/aiBatch";

import { useStudioCatalogs } from "../useStudioCatalogs";

import {
  DEFAULT_CONCURRENCY,
  MAX_BATCH_SIZE,
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  generateBatchLesson,
  runBatchPool,
  type ItemResult,
  type ItemState,
} from "./batchPool";
import styles from "./BatchClient.module.css";

/** A SOW lesson as rendered in the checklist. */
interface BatchLesson {
  id: string;
  orderIndex: number;
  week: number | null;
  lessonNumber: string | null;
  /** Short label derived from the lesson's competence/activity. */
  snippet: string;
}

/** First non-empty trimmed string, truncated for display. */
function firstSnippet(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const s = (v ?? "").trim();
    if (s) return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  return "";
}

export default function BatchClient({
  apiKeyConfigured,
}: {
  apiKeyConfigured: boolean;
}) {
  const t = useTranslations("lpStudio.batch");

  // ── Lists (shared bootstrap with the single-plan studio) ──────────────
  const { schemes } = useStudioCatalogs();

  // ── Scheme + lessons ──────────────────────────────────────────────────
  const [schemeId, setSchemeId] = useState<string>("");
  const [lessons, setLessons] = useState<BatchLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Config ────────────────────────────────────────────────────────────
  // The model and prompts are admin settings (AI Studio → Settings); the batch
  // route resolves them server-side, so concurrency is all that is set here.
  const [concurrency, setConcurrency] = useState<number>(DEFAULT_CONCURRENCY);

  // ── Run state ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<Record<string, ItemResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  // Guard against overlapping runs.
  const runningRef = useRef(false);

  // ── Load lessons when a scheme is chosen ──────────────────────────────
  const handleSchemeChange = useCallback(async (id: string) => {
    setSchemeId(id);
    setLessons([]);
    setSelectedIds(new Set());
    setItems({});
    setFinished(false);
    setError(null);
    if (!id) return;

    setLoadingLessons(true);
    try {
      const res = await getScheme(id);
      if (res.ok && res.lessons) {
        const mapped: BatchLesson[] = res.lessons.map((l) => ({
          id: l.id,
          orderIndex: l.orderIndex,
          week: l.week,
          lessonNumber: l.lessonNumber,
          snippet: firstSnippet(
            l.specificCompetence,
            l.mainActivity,
            l.lessonObjective,
          ),
        }));
        setLessons(mapped);
        // Default: all lessons selected.
        setSelectedIds(new Set(mapped.map((l) => l.id)));
      } else {
        setError(t("loadError"));
      }
    } finally {
      setLoadingLessons(false);
    }
  }, [t]);

  // ── Selection helpers ─────────────────────────────────────────────────
  const toggleLesson = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(lessons.map((l) => l.id)));
  }, [lessons]);

  const selectNone = useCallback(() => setSelectedIds(new Set()), []);

  const selectedLessons = useMemo(
    () => lessons.filter((l) => selectedIds.has(l.id)),
    [lessons, selectedIds],
  );
  const selectedCount = selectedLessons.length;
  const tooMany = selectedCount > MAX_BATCH_SIZE;

  // ── Counts for progress ───────────────────────────────────────────────
  const doneCount = useMemo(
    () =>
      Object.values(items).filter(
        (i) => i.state === "ok" || i.state === "warn" || i.state === "error",
      ).length,
    [items],
  );
  const okCount = useMemo(
    () =>
      Object.values(items).filter((i) => i.state === "ok" || i.state === "warn").length,
    [items],
  );
  const failedCount = useMemo(
    () => Object.values(items).filter((i) => i.state === "error").length,
    [items],
  );
  const plannedCount = Object.keys(items).length;
  const pct =
    plannedCount > 0 ? Math.min(100, Math.round((doneCount / plannedCount) * 100)) : 0;

  const labelFor = useCallback(
    (l: BatchLesson) =>
      `W${l.week ?? "?"}·L${l.lessonNumber ?? l.orderIndex + 1}`,
    [],
  );

  // ── Run the pool over a set of lesson ids ──────────────────────────────
  const runPool = useCallback(
    async (idsToRun: string[], reset = false) => {
      if (runningRef.current || idsToRun.length === 0) return;
      runningRef.current = true;
      setIsRunning(true);
      setFinished(false);
      setError(null);

      // Seed item state. A fresh run (`reset`) replaces the list so progress
      // shows only this run; a retry merges so prior results stay visible.
      setItems((prev) => {
        const next = reset ? {} : { ...prev };
        for (const id of idsToRun) next[id] = { state: "queued" };
        return next;
      });

      // Record the run for history (best-effort; failure doesn't block).
      let generationId: string | null = null;
      const startRes = await startBatchRun({ schemeId, lessonIds: idsToRun });
      if (startRes.ok && startRes.generationId) generationId = startRes.generationId;

      const lessonById = new Map(lessons.map((l) => [l.id, l]));
      const tally = await runBatchPool(idsToRun, concurrency, {
        generate: (lessonId) =>
          generateBatchLesson({ schemeLessonId: lessonId }),
        onItemUpdate: (id, result) =>
          setItems((prev) => ({ ...prev, [id]: result })),
        labelFor: (id) => {
          const lesson = lessonById.get(id);
          return lesson ? labelFor(lesson) : id;
        },
      });

      // Finalise the audit row (best-effort).
      if (generationId) {
        await finishBatchRun(generationId, tally);
      }

      runningRef.current = false;
      setIsRunning(false);
      setFinished(true);
    },
    [schemeId, concurrency, lessons, labelFor],
  );

  const handleGenerate = useCallback(() => {
    if (tooMany) return;
    void runPool(selectedLessons.map((l) => l.id), true);
  }, [tooMany, runPool, selectedLessons]);

  const handleRetryFailed = useCallback(() => {
    const failedIds = Object.entries(items)
      .filter(([, v]) => v.state === "error")
      .map(([id]) => id);
    if (failedIds.length > 0) void runPool(failedIds);
  }, [items, runPool]);

  // ── Derived flags ─────────────────────────────────────────────────────
  const canStart =
    apiKeyConfigured && !isRunning && selectedCount > 0 && !tooMany;
  const hasRun = plannedCount > 0;

  function itemTone(state: ItemState): string | undefined {
    switch (state) {
      case "running":
        return styles.toneRunning;
      case "ok":
        return styles.toneOk;
      case "warn":
        return styles.toneWarn;
      case "error":
        return styles.toneError;
      default:
        return styles.tonePending;
    }
  }

  return (
    <div className={styles.studio}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{t("title")}</h1>
          <Link href="/admin/ai-studio" className={styles.backLink}>
            {t("backLink")}
          </Link>
        </div>
        <p className={styles.subtitle}>
          {t.rich("subtitle", { strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </header>

      {!apiKeyConfigured && (
        <div className={styles.keyNotice} role="status">
          {t.rich("keyNotice", { code: (chunks) => <code>{chunks}</code> })}
        </div>
      )}

      <div className={styles.grid}>
        {/* ── Inputs ─────────────────────────────────────────── */}
        <section className={styles.panel} aria-label={t("inputsAria")}>
          {/* Scheme */}
          <h2 className={styles.panelTitle}>{t("schemeHeading")}</h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="batch-scheme">
              {t("schemeLabel")}
            </label>
            {schemes.length === 0 ? (
              <p className={styles.muted}>{t("noSchemes")}</p>
            ) : (
              <select
                id="batch-scheme"
                className={styles.select}
                value={schemeId}
                onChange={(e) => void handleSchemeChange(e.target.value)}
                disabled={isRunning}
              >
                <option value="">{t("schemePlaceholder")}</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {t("schemeMeta", { count: s.rowCount })}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lessons */}
          {schemeId && (
            <>
              <div className={styles.selectBar}>
                <h2 className={styles.panelTitle}>{t("lessonsHeading")}</h2>
                <span className={styles.count}>
                  {t("selectedCount", {
                    selected: selectedCount,
                    total: lessons.length,
                  })}
                </span>
              </div>

              {loadingLessons ? (
                <p className={styles.muted}>{t("loadingLessons")}</p>
              ) : lessons.length === 0 ? (
                <p className={styles.muted}>{t("noLessons")}</p>
              ) : (
                <>
                  <div className={styles.selectBar}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={selectAll}
                      disabled={isRunning}
                    >
                      {t("selectAll")}
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={selectNone}
                      disabled={isRunning}
                    >
                      {t("selectNone")}
                    </button>
                  </div>

                  <div className={styles.checkList}>
                    {lessons.map((l) => (
                      <label key={l.id} className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(l.id)}
                          onChange={() => toggleLesson(l.id)}
                          disabled={isRunning}
                        />
                        <span className={styles.checkText}>
                          <span className={styles.checkCoord}>{labelFor(l)}</span>
                          {l.snippet && (
                            <span className={styles.checkSnippet}>{l.snippet}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  {tooMany && (
                    <p className={styles.error} role="alert">
                      {t("tooMany", { count: selectedCount, max: MAX_BATCH_SIZE })}
                    </p>
                  )}
                </>
              )}

              {/* Config */}
              <h2 className={styles.panelTitle}>{t("configHeading")}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="batch-concurrency">
                  {t("concurrency")}
                </label>
                <input
                  id="batch-concurrency"
                  className={styles.input}
                  type="number"
                  min={MIN_CONCURRENCY}
                  max={MAX_CONCURRENCY}
                  inputMode="numeric"
                  value={concurrency}
                  disabled={isRunning}
                  onChange={(e) => {
                    const n = Math.trunc(Number(e.target.value));
                    setConcurrency(
                      Number.isFinite(n)
                        ? Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, n))
                        : DEFAULT_CONCURRENCY,
                    );
                  }}
                />
                <span className={styles.hint}>{t("concurrencyHint")}</span>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleGenerate}
                  disabled={!canStart}
                  title={apiKeyConfigured ? undefined : t("startDisabledTitle")}
                >
                  {isRunning
                    ? t("running")
                    : t("startBatch", {
                        count: selectedCount,
                        plans: t("plansWord", { count: selectedCount }),
                      })}
                </button>
              </div>
            </>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        {/* ── Progress ───────────────────────────────────────── */}
        <section className={styles.panel} aria-label={t("progressAria")}>
          <h2 className={styles.panelTitle}>
            {t("progressHeading")}
            {isRunning && <span className={styles.streamingDot} aria-hidden="true" />}
          </h2>

          {!hasRun && (
            <p className={styles.placeholder}>{t("progressPlaceholder")}</p>
          )}

          {hasRun && (
            <div className={styles.progressBlock}>
              <div className={styles.statusRow}>
                <span className={styles.count}>
                  {t("createdCount", { done: doneCount, planned: plannedCount })}
                </span>
              </div>

              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>

              {finished && !isRunning && (
                <p className={styles.summary}>
                  {failedCount === 0
                    ? t("summaryOk", { total: plannedCount })
                    : okCount === 0
                      ? t("summaryFailed", { total: plannedCount })
                      : t("summaryPartial", {
                          succeeded: okCount,
                          failed: failedCount,
                          total: plannedCount,
                        })}
                </p>
              )}

              <ul className={styles.planList}>
                {lessons
                  .filter((l) => items[l.id])
                  .map((l) => {
                    const it = items[l.id]!;
                    return (
                      <li key={l.id} className={styles.planItem}>
                        <div className={styles.planLink}>
                          <span className={styles.planCoord}>{labelFor(l)}</span>
                          {it.slug ? (
                            <Link href={`/plans/${it.slug}`} className={styles.planTitle}>
                              {l.snippet || l.id}
                            </Link>
                          ) : (
                            <span className={styles.planTitle}>{l.snippet}</span>
                          )}
                          <span
                            className={`${styles.statusPill} ${itemTone(it.state)}`}
                          >
                            {t(`itemStatus.${it.state}`)}
                          </span>
                        </div>
                        {it.state === "warn" && (
                          <span className={styles.issuesNote}>{t("issuesNote")}</span>
                        )}
                        {it.state === "error" && it.error && (
                          <span className={styles.planMeta}>{it.error}</span>
                        )}
                      </li>
                    );
                  })}
              </ul>

              {finished && !isRunning && failedCount > 0 && (
                <div className={styles.doneRow}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={handleRetryFailed}
                    disabled={!apiKeyConfigured}
                  >
                    {t("retryFailed")}
                  </button>
                </div>
              )}

              {finished && !isRunning && (
                <div className={styles.doneRow}>
                  <Link href="/admin/ai-studio" className={styles.secondaryBtn}>
                    {t("backToStudio")}
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
