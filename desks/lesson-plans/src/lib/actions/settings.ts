"use server";

/**
 * Admin server actions — AI Studio Settings.
 *
 * Reads/writes the `app_settings` rows behind the Settings tab. Keyed upserts,
 * exactly like prompt parts (see `./prompts`). All actions are admin-only.
 *
 * The generation model is allowlisted against CURATED_MODELS on save: the
 * picker only ever offers those, and a slug the provider doesn't know would
 * fail every subsequent generation. The resolver re-checks on read for the case
 * this cannot cover — a slug that was curated when saved but was dropped by a
 * later release (see `@/lib/ai/modelSetting`).
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  GENERATION_MODEL_KEY,
  isSelectableModelId,
} from "@/lib/ai/modelSetting";

// ── getGenerationModel ────────────────────────────────────────────────────────

/**
 * The stored generation-model slug, or `undefined` when none is set (in which
 * case generation falls back to AI_MODEL_ID — see `resolveGenerationModelId`).
 * Admin-only.
 */
export async function getGenerationModel(): Promise<
  ActionResult & { modelId?: string }
> {
  await requireAdmin();

  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, GENERATION_MODEL_KEY))
      .limit(1);

    return { ok: true, modelId: row?.value };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── setGenerationModel ────────────────────────────────────────────────────────

/**
 * Persist the generation-model slug. Rejects anything outside CURATED_MODELS.
 * Admin-only.
 */
export async function setGenerationModel(
  modelId: string,
): Promise<ActionResult> {
  const user = await requireAdmin();

  const slug = modelId.trim();
  if (!slug || !isSelectableModelId(slug)) {
    return actionFailure("invalid-input");
  }

  try {
    await db
      .insert(appSettings)
      .values({
        key: GENERATION_MODEL_KEY,
        value: slug,
        updatedBy: user.id,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: slug,
          updatedBy: user.id,
        },
      });

    revalidatePath("/[locale]/admin/ai-studio/settings", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
