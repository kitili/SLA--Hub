/**
 * Batch generation engine — the pure half of BatchClient.
 *
 * `generateBatchLesson` turns one SOW lesson into a saved draft plan via
 * `POST /api/ai/batch/lesson` (the exact v2 single-generation pipeline),
 * retrying transient failures with back-off; `runBatchPool` drives a set of
 * lesson ids through a FOREGROUND bounded-concurrency worker pool and tallies
 * the outcome locally (reading React state right after the pool can be stale).
 *
 * Retry classification: HTTP 400 (bad input / no key) and an application-level
 * `ok: false` payload are terminal; 429 / 5xx / network errors retry with
 * back-off. One failed item never sinks the batch — it lands in the tally.
 *
 * No React in here: the UI observes progress through the `onItemUpdate`
 * callback and owns everything else (item seeding, audit rows, flags). Pure
 * module so vitest can drive the pool with stubbed deps.
 */

/** Cap on how many plans one batch may request — guards against runaway runs. */
export const MAX_BATCH_SIZE = 60;
/** Default / bounds for the parallel-generation pool. */
export const DEFAULT_CONCURRENCY = 4;
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 8;
/** Back-off (ms) before retry attempts 1 and 2 on transient failures. */
export const RETRY_BACKOFF_MS = [2000, 6000];

export type ItemState = "queued" | "running" | "ok" | "warn" | "error";

export interface ItemResult {
  state: ItemState;
  planId?: string;
  slug?: string;
  issues?: string[];
  error?: string;
}

/** Outcome of one lesson generation after retries are exhausted. */
export type GenerateLessonOutcome =
  | { ok: true; planId?: string; slug?: string; issues?: string[] }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Injectable I/O for tests; production uses the browser fetch + real timers. */
export interface GenerateLessonDeps {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<unknown>;
}

/** Generate one lesson (with retry/back-off on transient failures). */
export async function generateBatchLesson(
  request: {
    schemeLessonId: string;
  },
  deps: GenerateLessonDeps = {},
): Promise<GenerateLessonOutcome> {
  // Wrap the global fetch so the extracted reference keeps its window binding.
  const fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
  const sleepFn = deps.sleepFn ?? sleep;
  let lastError = "Generation failed.";

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetchFn("/api/ai/batch/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          planId?: string;
          slug?: string;
          issues?: string[];
          error?: string;
        };
        if (data.ok) {
          return {
            ok: true,
            planId: data.planId,
            slug: data.slug,
            issues: data.issues,
          };
        }
        return { ok: false, error: data.error ?? lastError };
      }

      // Non-OK. 400 = bad input / no key → not retryable.
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      lastError = data.error ?? `Request failed (${res.status}).`;
      if (res.status === 400) return { ok: false, error: lastError };
      // 429 / 5xx → retry with back-off.
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Network error → retry with back-off.
    }

    const backoff = RETRY_BACKOFF_MS[attempt];
    if (backoff !== undefined) await sleepFn(backoff);
  }
  return { ok: false, error: lastError };
}

export interface BatchPoolCallbacks {
  /** Generate one lesson — in production, `generateBatchLesson`. */
  generate: (lessonId: string) => Promise<GenerateLessonOutcome>;
  /** Progress hook: fired when an item starts running and when it settles. */
  onItemUpdate: (lessonId: string, result: ItemResult) => void;
  /** Short display label for an id (e.g. "W2·L3"), used in the error tally. */
  labelFor: (lessonId: string) => string;
}

/** The locally-computed outcome of one pool run (feeds `finishBatchRun`). */
export interface BatchTally {
  succeeded: number;
  failed: number;
  planIds: string[];
  errors: string[];
}

/**
 * Run the worker pool over a set of lesson ids. `concurrency` is clamped to
 * [MIN_CONCURRENCY, MAX_CONCURRENCY]; workers pull the next id via a shared
 * cursor until the list is drained.
 */
export async function runBatchPool(
  idsToRun: string[],
  concurrency: number,
  cb: BatchPoolCallbacks,
): Promise<BatchTally> {
  const planIds: string[] = [];
  const errors: string[] = [];
  let succeeded = 0;
  let failed = 0;

  let cursor = 0;
  const pool = Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, concurrency));

  const worker = async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= idsToRun.length) break;
      const id = idsToRun[i];
      if (id === undefined) break;

      cb.onItemUpdate(id, { state: "running" });
      const r = await cb.generate(id);

      if (r.ok) {
        succeeded += 1;
        if (r.planId) planIds.push(r.planId);
        cb.onItemUpdate(id, {
          state: r.issues && r.issues.length ? "warn" : "ok",
          planId: r.planId,
          slug: r.slug,
          issues: r.issues,
        });
      } else {
        failed += 1;
        errors.push(`${cb.labelFor(id)}: ${r.error}`);
        cb.onItemUpdate(id, { state: "error", error: r.error });
      }
    }
  };

  await Promise.all(Array.from({ length: pool }, () => worker()));

  return { succeeded, failed, planIds, errors };
}
