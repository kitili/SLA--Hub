import "server-only";

/**
 * Resolving the generation model from the admin Settings tab.
 *
 * The model used for lesson-plan generation is layered, most specific first:
 *
 *   1. the `ai.generation_model` row in `app_settings` (AI Studio → Settings)
 *   2. the AI_MODEL_ID env var
 *   3. the built-in default
 *
 * (2) and (3) are already folded into {@link MODEL_ID}, so this module only
 * adds layer (1) on top.
 *
 * This lives outside `model.ts` deliberately: that module is pure provider
 * wiring and Client Components type-import `OpenRouterModel` from it, so it
 * stays free of a database dependency.
 *
 * Callers are the two generation routes and the save/audit actions — never a
 * Client Component. The route handlers resolve the model themselves rather than
 * accepting one from the request body, so a crafted request cannot pick the
 * model. See docs/ai-studio.md.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

import { CURATED_MODELS, MODEL_ID } from "./model";

/** The `app_settings.key` holding the generation model slug. */
export const GENERATION_MODEL_KEY = "ai.generation_model" as const;

/**
 * Is `modelId` a slug an admin is allowed to select?
 *
 * Checked against the static {@link CURATED_MODELS} list rather than the live
 * `listCuratedModels()` catalogue: this runs on every generation (once per
 * lesson in a batch) and must not depend on a network round-trip.
 */
export function isSelectableModelId(modelId: string): boolean {
  return CURATED_MODELS.some((m) => m.id === modelId);
}

/**
 * The OpenRouter slug to generate with.
 *
 * Falls back to {@link MODEL_ID} when no setting is stored, and *also* when the
 * stored slug is no longer selectable — a curated slug removed in a later
 * release would otherwise be handed to OpenRouter and fail every generation.
 * Write-time validation alone cannot prevent that, since the stored value
 * outlives the code that validated it.
 */
export async function resolveGenerationModelId(): Promise<string> {
  let stored: string | undefined;
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, GENERATION_MODEL_KEY))
      .limit(1);
    stored = row?.value;
  } catch (err) {
    // A settings read must never take generation down with it.
    console.error("[ai/modelSetting] could not read the model setting:", err);
    return MODEL_ID;
  }

  if (!stored) return MODEL_ID;

  if (!isSelectableModelId(stored)) {
    console.error(
      `[ai/modelSetting] stored model "${stored}" is no longer selectable — falling back to ${MODEL_ID}.`,
    );
    return MODEL_ID;
  }

  return stored;
}
