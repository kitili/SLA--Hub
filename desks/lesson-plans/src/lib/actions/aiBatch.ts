"use server";

/**
 * AI Studio batch-generation server actions.
 *
 * Batch generation runs in the FOREGROUND: the browser drives a
 * bounded-concurrency pool that calls `POST /api/ai/batch/lesson` once per
 * selected SOW lesson. These actions bookend a run with a single
 * `ai_generations` audit row (`startBatchRun` / `finishBatchRun`) so a
 * completed batch is recorded for history — live progress is tracked in React
 * state, not by polling.
 *
 * Admin-only — batch generation is an admin feature.
 */
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { aiGenerations } from "@/lib/db/schema";
import { resolveGenerationModelId } from "@/lib/ai/modelSetting";

/**
 * Create the batch audit row up front. Returns its id. Admin-only.
 *
 * The model is resolved from the admin Settings tab, not taken from the caller,
 * so the audit row records the model the run will actually use.
 */
export async function startBatchRun(input: {
  schemeId: string;
  lessonIds: string[];
}): Promise<ActionResult & { generationId?: string }> {
  const user = await requireAdmin();

  const lessonIds = input.lessonIds.filter(Boolean);
  if (!input.schemeId || lessonIds.length === 0) {
    return actionFailure("invalid-input");
  }

  try {
    const created = await db
      .insert(aiGenerations)
      .values({
        requestedBy: user.id,
        mode: "batch",
        modelId: await resolveGenerationModelId(),
        inputParams: {
          schemeId: input.schemeId,
          lessonIds,
          plannedTotal: lessonIds.length,
        },
        status: "streaming",
        resultPlanIds: [],
      })
      .returning();

    const generationId = created[0]?.id;
    if (!generationId) {
      return actionFailure("failed", { cause: "insert returned no generation id" });
    }
    return { ok: true, generationId };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

/** Finalise the batch audit row with the run summary. Admin-only. */
export async function finishBatchRun(
  generationId: string,
  summary: {
    succeeded: number;
    failed: number;
    planIds: string[];
    errors?: string[];
  },
): Promise<ActionResult> {
  await requireAdmin();

  if (!generationId) return actionFailure("invalid-input");

  const status =
    summary.failed === 0
      ? "succeeded"
      : summary.succeeded === 0
        ? "failed"
        : "partial";

  try {
    await db
      .update(aiGenerations)
      .set({
        status,
        resultPlanIds: summary.planIds,
        error: summary.errors && summary.errors.length ? summary.errors.join("; ") : null,
        completedAt: new Date(),
      })
      .where(eq(aiGenerations.id, generationId));
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
