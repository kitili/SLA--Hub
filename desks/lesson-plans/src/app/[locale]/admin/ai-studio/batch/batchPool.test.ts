/**
 * Unit tests for the batch generation engine (batchPool.ts): retry/back-off
 * classification in `generateBatchLesson` and concurrency bound + tally
 * correctness in `runBatchPool`. All I/O is injected — no timers, no network.
 */
import { describe, expect, it, vi } from "vitest";

import {
  MAX_CONCURRENCY,
  RETRY_BACKOFF_MS,
  generateBatchLesson,
  runBatchPool,
  type ItemResult,
} from "./batchPool";

/** Minimal Response stand-in for the fields the engine reads. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** A json() that rejects, like an empty/HTML error body. */
function brokenJsonResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error("no body");
    },
  } as unknown as Response;
}

const REQUEST = { schemeLessonId: "sl-1" };

describe("generateBatchLesson", () => {
  it("returns the saved plan on first success and posts the exact body", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, { ok: true, planId: "p1", slug: "s1", issues: ["i1"] }),
    );
    const sleepFn = vi.fn(async () => {});

    const outcome = await generateBatchLesson(REQUEST, { fetchFn, sleepFn });

    expect(outcome).toEqual({ ok: true, planId: "p1", slug: "s1", issues: ["i1"] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
    const [url, init] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/batch/lesson");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ schemeLessonId: "sl-1" });
  });

  it("never sends a model or prompt override — the route resolves both", async () => {
    // The model and prompts are admin settings, not per-request knobs; the
    // route ignores them either way, but the client must not imply otherwise.
    const fetchFn = vi.fn(async () => jsonResponse(200, { ok: true }));
    await generateBatchLesson(REQUEST, { fetchFn, sleepFn: async () => {} });
    const [, init] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit];
    expect(init.body as string).not.toContain("promptOverrides");
    expect(init.body as string).not.toContain("modelId");
  });

  it("treats an application-level ok:false as terminal (no retry)", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, { ok: false, error: "model refused" }),
    );
    const sleepFn = vi.fn(async () => {});
    const outcome = await generateBatchLesson(REQUEST, { fetchFn, sleepFn });
    expect(outcome).toEqual({ ok: false, error: "model refused" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("treats HTTP 400 as terminal, surfacing the authored error", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(400, { error: "bad input" }));
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async () => {},
    });
    expect(outcome).toEqual({ ok: false, error: "bad input" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to a status message when the 400 body is not JSON", async () => {
    const fetchFn = vi.fn(async () => brokenJsonResponse(400));
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async () => {},
    });
    expect(outcome).toEqual({ ok: false, error: "Request failed (400)." });
  });

  it("retries 5xx with the configured back-off, then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(brokenJsonResponse(500))
      .mockResolvedValueOnce(brokenJsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, planId: "p1" }));
    const sleeps: number[] = [];
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(outcome).toEqual({ ok: true, planId: "p1", slug: undefined, issues: undefined });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual(RETRY_BACKOFF_MS);
  });

  it("gives up after exhausting retries on persistent 429, keeping the last error", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(429, { error: "rate limited" }));
    const sleeps: number[] = [];
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(outcome).toEqual({ ok: false, error: "rate limited" });
    expect(fetchFn).toHaveBeenCalledTimes(1 + RETRY_BACKOFF_MS.length);
    expect(sleeps).toEqual(RETRY_BACKOFF_MS);
  });

  it("retries network errors and surfaces the thrown message when persistent", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async () => {},
    });
    expect(outcome).toEqual({ ok: false, error: "connection reset" });
    expect(fetchFn).toHaveBeenCalledTimes(1 + RETRY_BACKOFF_MS.length);
  });

  it("recovers when the network comes back mid-retries", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, slug: "s9" }));
    const outcome = await generateBatchLesson(REQUEST, {
      fetchFn,
      sleepFn: async () => {},
    });
    expect(outcome).toMatchObject({ ok: true, slug: "s9" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("runBatchPool", () => {
  it("never exceeds the requested concurrency", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);
    let active = 0;
    let maxActive = 0;
    const tally = await runBatchPool(ids, 3, {
      generate: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 1));
        active -= 1;
        return { ok: true };
      },
      onItemUpdate: () => {},
      labelFor: (id) => id,
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(tally.succeeded).toBe(12);
  });

  it("clamps out-of-range concurrency to the configured bounds", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
    let active = 0;
    let maxActive = 0;
    const generate = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 1));
      active -= 1;
      return { ok: true } as const;
    };
    await runBatchPool(ids, 99, { generate, onItemUpdate: () => {}, labelFor: (id) => id });
    expect(maxActive).toBeLessThanOrEqual(MAX_CONCURRENCY);

    maxActive = 0;
    await runBatchPool(ids, 0, { generate, onItemUpdate: () => {}, labelFor: (id) => id });
    expect(maxActive).toBe(1);
  });

  it("tallies successes/failures and formats errors with the display label", async () => {
    const updates: Array<[string, ItemResult]> = [];
    const tally = await runBatchPool(["a", "b", "c"], 1, {
      generate: async (id) => {
        if (id === "a") return { ok: true, planId: "p-a", slug: "s-a" };
        if (id === "b") return { ok: true, issues: ["voice"] };
        return { ok: false, error: "boom" };
      },
      onItemUpdate: (id, result) => updates.push([id, result]),
      labelFor: (id) => `W1·L${id}`,
    });

    expect(tally).toEqual({
      succeeded: 2,
      failed: 1,
      planIds: ["p-a"],
      errors: ["W1·Lc: boom"],
    });

    // Each item goes running → settled, in cursor order at concurrency 1.
    expect(updates).toEqual([
      ["a", { state: "running" }],
      ["a", { state: "ok", planId: "p-a", slug: "s-a", issues: undefined }],
      ["b", { state: "running" }],
      ["b", { state: "warn", planId: undefined, slug: undefined, issues: ["voice"] }],
      ["c", { state: "running" }],
      ["c", { state: "error", error: "boom" }],
    ]);
  });

  it("returns a zero tally for an empty id list without calling generate", async () => {
    const generate = vi.fn();
    const tally = await runBatchPool([], 4, {
      generate,
      onItemUpdate: () => {},
      labelFor: (id) => id,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(tally).toEqual({ succeeded: 0, failed: 0, planIds: [], errors: [] });
  });
});
