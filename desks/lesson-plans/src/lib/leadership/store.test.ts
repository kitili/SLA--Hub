import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { samplePayload } from "./fixtures";
import { pgliteSql } from "./pglite-sql";
import { ensureLeadershipTables, readLeadershipSnapshot, replaceLeadershipSnapshot } from "./store";

let db: PGlite;
let sql: ReturnType<typeof pgliteSql>;

// PGlite's WASM start-up is slow when the whole suite runs in parallel.
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  sql = pgliteSql(db);
}, 60_000);
afterAll(async () => {
  await db.close();
});

describe("leadership store (real SQL on PGlite)", { timeout: 30_000 }, () => {
  it("reads null before the first push, and creating the tables twice is harmless", async () => {
    await ensureLeadershipTables(sql);
    await ensureLeadershipTables(sql);
    expect(await readLeadershipSnapshot(sql)).toBeNull();
  });

  it("round-trips a snapshot exactly, in order", async () => {
    const payload = samplePayload();
    const counts = await replaceLeadershipSnapshot(sql, payload);
    expect(counts).toEqual({ walkthroughs: 2, observations: 1 });
    expect(await readLeadershipSnapshot(sql)).toEqual(payload);
  });

  it("keeps markup in notes as plain text", async () => {
    const stored = await readLeadershipSnapshot(sql);
    expect(stored?.walkthroughs[1]?.notes).toBe("<b>not markup</b>");
  });

  it("replaces, never appends, on the next push", async () => {
    const next = samplePayload({
      walkthroughs: [samplePayload().walkthroughs[0]!],
      observations: [],
      generatedAt: "2026-10-30T06:00:00.000Z",
    });
    await replaceLeadershipSnapshot(sql, next);
    const stored = await readLeadershipSnapshot(sql);
    expect(stored?.walkthroughs).toHaveLength(1);
    expect(stored?.observations).toHaveLength(0);
    expect(stored?.generatedAt).toBe("2026-10-30T06:00:00.000Z");
    const rows = (await db.query("select count(*)::int as n from ild_walkthroughs")).rows as { n: number }[];
    expect(rows[0]?.n).toBe(1);
  });

  it("accepts an empty snapshot", async () => {
    await replaceLeadershipSnapshot(sql, samplePayload({ walkthroughs: [], observations: [] }));
    const stored = await readLeadershipSnapshot(sql);
    expect(stored?.walkthroughs).toEqual([]);
  });

  it("leaves the last good snapshot if a push fails midway", async () => {
    const good = samplePayload({ generatedAt: "2026-11-01T06:00:00.000Z" });
    await replaceLeadershipSnapshot(sql, good);
    const broken = new Proxy(sql, {
      apply(target, thisArg, args) {
        const query = Reflect.apply(target, thisArg, args) as { text: string };
        // Break the observations insert, after the deletes have already run.
        if (query.text.includes("INSERT INTO ild_observations")) query.text = "INSERT INTO no_such_table VALUES (1)";
        return query;
      },
    }) as typeof sql;
    broken.transaction = sql.transaction;
    await expect(replaceLeadershipSnapshot(broken, samplePayload({ generatedAt: "2026-12-01T06:00:00.000Z" }))).rejects.toThrow();
    expect(await readLeadershipSnapshot(sql)).toEqual(good);
  });

  it("keeps only the newest 200 sync-log rows", async () => {
    for (let i = 0; i < 3; i += 1) await replaceLeadershipSnapshot(sql, samplePayload());
    const rows = (await db.query("select count(*)::int as n from ild_sync_log")).rows as { n: number }[];
    expect(rows[0]?.n).toBeGreaterThan(0);
    expect(rows[0]?.n).toBeLessThanOrEqual(200);
  });
});
