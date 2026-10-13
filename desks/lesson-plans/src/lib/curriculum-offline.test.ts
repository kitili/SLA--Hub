import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readOffline, saveOffline, withOfflineCache } from "./curriculum-offline";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "curriculum-cache-"));
  process.env.CURRICULUM_CACHE_DIR = dir;
});

afterEach(async () => {
  delete process.env.CURRICULUM_CACHE_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("curriculum offline copy", () => {
  it("round-trips a saved copy and ignores a missing file", async () => {
    await saveOffline("sample.json", { n: 2 });
    expect(await readOffline("sample.json")).toEqual({ n: 2 });
    expect(await readOffline("missing.json")).toBeNull();
  });

  it("keeps the last good copy when the live read fails", async () => {
    await saveOffline("rows.json", [{ id: "a" }]);
    const loaded = await withOfflineCache("rows.json", async () => {
      throw new Error("fetch failed");
    });
    expect(loaded).toEqual({ data: [{ id: "a" }], source: "offline" });
  });

  it("returns the live rows when the copy cannot be written", async () => {
    const blocked = path.join(dir, "not-a-directory");
    await writeFile(blocked, "x");
    process.env.CURRICULUM_CACHE_DIR = blocked;
    const loaded = await withOfflineCache("rows.json", async () => [{ id: "live" }]);
    expect(loaded).toEqual({ data: [{ id: "live" }], source: "live" });
  });

  it("reads the local copy when no live database is configured", async () => {
    expect(await withOfflineCache("rows.json", null)).toBeNull();
    await saveOffline("rows.json", [{ id: "b" }]);
    expect(await withOfflineCache("rows.json", null)).toEqual({
      data: [{ id: "b" }],
      source: "offline",
    });
  });
});
