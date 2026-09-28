"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import type { ApiError } from "@/lib/contracts";
import * as adminQueries from "@/lib/db/queries/admin";
import { policyBriefingsRepo } from "@/lib/db/repositories";
import { parseBriefingScript } from "@/lib/policy-briefing-script";
import {
  queueBriefingForItem,
  runPolicyBriefingGeneration,
} from "@/lib/policy-briefing-queue";
import { scheduleSlaBotKnowledgeSync } from "@/lib/sla-bot-knowledge";

export type BriefingActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError["error"] };

function fail(
  code: string,
  message: string,
): { ok: false; error: ApiError["error"] } {
  return { ok: false, error: { code, message } };
}

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

function revalidate(sectionId: string): void {
  revalidatePath(`/admin/sections/${sectionId}`);
  revalidatePath(`/[locale]/section/${sectionId}`, "page");
  revalidatePath("/[locale]", "page");
}

/** Generate (or regenerate) a draft briefing from the item's current PDF/DOCX. */
export async function generatePolicyBriefingAction(
  itemId: string,
): Promise<BriefingActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 50) {
    return fail("VALIDATION_ERROR", "Invalid learning item.");
  }

  const briefingId = await queueBriefingForItem(itemId, admin.id, false);
  if (!briefingId) {
    return fail(
      "VALIDATION_ERROR",
      "Attach a PDF or Word policy file before generating a briefing.",
    );
  }

  await runPolicyBriefingGeneration(briefingId);
  const row = await policyBriefingsRepo.getBriefingById(briefingId);
  if (row?.status === "failed") {
    return fail("GENERATION_FAILED", row.errorMessage ?? "Briefing generation failed.");
  }

  const item = await adminQueries.findSectionItem(itemId);
  if (item) revalidate(item.sectionId);
  return ok({ id: briefingId });
}

/** Make a draft briefing the one members see. */
export async function publishPolicyBriefingAction(
  briefingId: string,
): Promise<BriefingActionResult> {
  await requireAdmin();
  if (typeof briefingId !== "string" || briefingId.length === 0) {
    return fail("VALIDATION_ERROR", "Invalid briefing.");
  }

  const row = await policyBriefingsRepo.getBriefingById(briefingId);
  if (!row) return fail("NOT_FOUND", "Briefing not found.");
  if (row.status !== "draft") {
    return fail("VALIDATION_ERROR", "Only a draft briefing can be published.");
  }
  if (!parseBriefingScript(row.scriptEn)) {
    return fail("VALIDATION_ERROR", "This draft is incomplete and cannot be published.");
  }

  const published = await policyBriefingsRepo.publishBriefing(briefingId);
  if (!published) return fail("NOT_FOUND", "Briefing not found.");

  const item = await adminQueries.findSectionItem(published.sectionItemId);
  if (item) revalidate(item.sectionId);
  scheduleSlaBotKnowledgeSync();
  return ok(undefined);
}
