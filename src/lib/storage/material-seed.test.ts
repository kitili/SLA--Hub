/**
 * Unit tests for seed material sync planning (preserve Blob/local uploads).
 */
import { describe, expect, it } from "vitest";

import {
  isPreservedUploadMaterial,
  planMaterialSeedSync,
} from "./material-seed";

describe("isPreservedUploadMaterial", () => {
  it("keeps Blob URLs", () => {
    expect(
      isPreservedUploadMaterial({
        id: "1",
        storageKey: "https://x.blob.vercel-storage.com/handbook.pdf",
        contentType: "application/pdf",
        size: 12000,
      }),
    ).toBe(true);
  });

  it("keeps YouTube embeds", () => {
    expect(
      isPreservedUploadMaterial({
        id: "1",
        storageKey: "https://www.youtube.com/embed/abc",
        contentType: "video/youtube",
        size: 0,
      }),
    ).toBe(true);
  });

  it("keeps flat local uploads with size", () => {
    expect(
      isPreservedUploadMaterial({
        id: "1",
        storageKey: "171000-uuid-handbook.pdf",
        contentType: "application/pdf",
        size: 5000,
      }),
    ).toBe(true);
  });

  it("does not keep seeded legacy paths", () => {
    expect(
      isPreservedUploadMaterial({
        id: "1",
        storageKey: "02 — Policies & Compliance/handbook.pdf",
        contentType: "application/pdf",
        size: 0,
      }),
    ).toBe(false);
  });
});

describe("planMaterialSeedSync", () => {
  it("inserts missing seed paths when there are no uploads", () => {
    const plan = planMaterialSeedSync(
      [
        {
          id: "a",
          storageKey: "policies/old.pdf",
          contentType: "application/pdf",
          size: 0,
        },
      ],
      ["policies/handbook.pdf"],
    );
    expect(plan.deleteIds).toEqual(["a"]);
    expect(plan.insertSeedKeys).toEqual(["policies/handbook.pdf"]);
    expect(plan.skipSeedInserts).toBe(false);
  });

  it("keeps Blob uploads and skips re-adding seed placeholders", () => {
    const plan = planMaterialSeedSync(
      [
        {
          id: "blob",
          storageKey: "https://x.blob.vercel-storage.com/handbook.pdf",
          contentType: "application/pdf",
          size: 99,
        },
        {
          id: "stale",
          storageKey: "policies/old.pdf",
          contentType: "application/pdf",
          size: 0,
        },
      ],
      ["policies/handbook.pdf"],
    );
    expect(plan.deleteIds).toEqual(["stale"]);
    expect(plan.insertSeedKeys).toEqual([]);
    expect(plan.skipSeedInserts).toBe(true);
  });

  it("leaves matching seed rows in place", () => {
    const plan = planMaterialSeedSync(
      [
        {
          id: "seed",
          storageKey: "policies/handbook.pdf",
          contentType: "application/pdf",
          size: 0,
        },
      ],
      ["policies/handbook.pdf"],
    );
    expect(plan.deleteIds).toEqual([]);
    expect(plan.insertSeedKeys).toEqual([]);
    expect(plan.keepSeedKeys).toEqual(["policies/handbook.pdf"]);
  });
});
