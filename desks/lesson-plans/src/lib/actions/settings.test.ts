/**
 * Tests for the AI Studio Settings actions and the generation-model resolver,
 * against the in-memory PGlite that test/setup.ts migrates per worker.
 *
 * Coverage:
 *   - a curated slug persists and reads back;
 *   - a slug outside CURATED_MODELS is REJECTED and leaves the stored value
 *     untouched — the picker only offers curated slugs, so a junk value can
 *     only arrive from a crafted call, and it would fail every generation;
 *   - the resolver layers correctly: stored value → AI_MODEL_ID → default;
 *   - the resolver falls back when the STORED slug is no longer curated. Save
 *     -time validation cannot cover this: the row outlives the code that
 *     validated it, so a curated slug dropped in a later release would
 *     otherwise be handed to OpenRouter and break generation.
 *
 * `requireAdmin` and `revalidatePath` are mocked as in aiStudio.test.ts.
 * Everything else (validation, upsert, read) is real.
 */
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { appSettings, staff } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/contracts";
import { CURATED_MODELS, MODEL_ID } from "@/lib/ai/model";
import {
  GENERATION_MODEL_KEY,
  isSelectableModelId,
  resolveGenerationModelId,
} from "@/lib/ai/modelSetting";
import { getGenerationModel, setGenerationModel } from "./settings";

/** A real curated slug, and a second one distinct from the default. */
const CURATED_SLUG = CURATED_MODELS[0]!.id;
const OTHER_CURATED_SLUG = CURATED_MODELS.find((m) => m.id !== MODEL_ID)!.id;

beforeAll(async () => {
  // `app_settings.updated_by` FKs → staff, so back the mocked admin with a
  // real row and point the mock at its generated id.
  const [admin] = await db
    .insert(staff)
    .values({ email: "settings-test@silverleaf.test", fullName: "Settings Tester" })
    .returning();
  const user: CurrentUser = {
    id: admin!.id,
    email: "settings-test@silverleaf.test",
    fullName: "Settings Tester",
    isAdmin: true,
    roles: [],
    campus: null,
    jobTitle: null,
  };
  vi.mocked(requireAdmin).mockResolvedValue(user);
});

beforeEach(async () => {
  // Each test starts with no stored setting.
  await db.delete(appSettings).where(eq(appSettings.key, GENERATION_MODEL_KEY));
});

describe("setGenerationModel", () => {
  it("persists a curated slug and reads it back", async () => {
    const res = await setGenerationModel(OTHER_CURATED_SLUG);
    expect(res.ok).toBe(true);

    const read = await getGenerationModel();
    expect(read.ok).toBe(true);
    expect(read.modelId).toBe(OTHER_CURATED_SLUG);
  });

  it("upserts rather than inserting a second row", async () => {
    await setGenerationModel(CURATED_SLUG);
    await setGenerationModel(OTHER_CURATED_SLUG);

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, GENERATION_MODEL_KEY));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(OTHER_CURATED_SLUG);
  });

  it("rejects a slug outside the curated list and stores nothing", async () => {
    const res = await setGenerationModel("evil/backdoor-model");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, GENERATION_MODEL_KEY));
    expect(rows).toHaveLength(0);
  });

  it("does not clobber an existing value when the new slug is rejected", async () => {
    await setGenerationModel(OTHER_CURATED_SLUG);

    const res = await setGenerationModel("evil/backdoor-model");
    expect(res.ok).toBe(false);

    const read = await getGenerationModel();
    expect(read.modelId).toBe(OTHER_CURATED_SLUG);
  });

  it("rejects an empty slug", async () => {
    const res = await setGenerationModel("   ");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");
  });
});

describe("getGenerationModel", () => {
  it("reports undefined when nothing is stored", async () => {
    const res = await getGenerationModel();
    expect(res.ok).toBe(true);
    expect(res.modelId).toBeUndefined();
  });
});

describe("isSelectableModelId", () => {
  it("accepts every curated slug and rejects an unknown one", () => {
    for (const m of CURATED_MODELS) {
      expect(isSelectableModelId(m.id)).toBe(true);
    }
    expect(isSelectableModelId("evil/backdoor-model")).toBe(false);
  });
});

describe("resolveGenerationModelId", () => {
  it("falls back to MODEL_ID when no setting is stored", async () => {
    await expect(resolveGenerationModelId()).resolves.toBe(MODEL_ID);
  });

  it("returns the stored slug once one is saved", async () => {
    await setGenerationModel(OTHER_CURATED_SLUG);
    await expect(resolveGenerationModelId()).resolves.toBe(OTHER_CURATED_SLUG);
  });

  it("falls back to MODEL_ID when the stored slug is no longer curated", async () => {
    // Bypass the action's validation to simulate a row written by an older
    // release whose slug has since been dropped from CURATED_MODELS.
    await db.insert(appSettings).values({
      key: GENERATION_MODEL_KEY,
      value: "retired/model-from-a-past-release",
    });

    await expect(resolveGenerationModelId()).resolves.toBe(MODEL_ID);
  });
});
