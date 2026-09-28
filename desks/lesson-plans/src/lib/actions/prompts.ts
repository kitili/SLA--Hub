"use server";

/**
 * Admin server actions — Prompt Parts (AI Studio v2).
 *
 * CRUD for the `prompt_parts` table. Parts are keyed by a stable `key` so
 * updates are upserts and "reset to default" restores the seed content from
 * DEFAULT_PROMPT_PART_MAP. All actions are admin-only. Mutations revalidate
 * the Settings admin page (which hosts the prompt editors) via its
 * "/[locale]/..." route pattern (locale-less literals match nothing — see
 * feedback.ts).
 */
import { asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { promptParts } from "@/lib/db/schema";
import {
  DEFAULT_PROMPT_PARTS,
  DEFAULT_PROMPT_PART_MAP,
  type PromptPartKey,
} from "@/lib/ai/lessonPlan/promptDefaults";

// Build a stable order map from the canonical DEFAULT_PROMPT_PARTS array.
const KEY_ORDER: Record<string, number> = Object.fromEntries(
  DEFAULT_PROMPT_PARTS.map((p, i) => [p.key, i]),
);

// ── listPromptParts ───────────────────────────────────────────────────────────

/**
 * List all prompt_parts rows ordered to match DEFAULT_PROMPT_PARTS order.
 * Admin-only.
 */
export async function listPromptParts(): Promise<
  ActionResult & { parts?: Array<typeof promptParts.$inferSelect> }
> {
  await requireAdmin();

  try {
    const rows = await db
      .select()
      .from(promptParts)
      .orderBy(asc(promptParts.createdAt));

    // Re-sort client-side to match canonical key order (table may have extras).
    const sorted = [...rows].sort((a, b) => {
      const ai = KEY_ORDER[a.key] ?? 999;
      const bi = KEY_ORDER[b.key] ?? 999;
      return ai - bi;
    });

    return { ok: true, parts: sorted };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── updatePromptPart ──────────────────────────────────────────────────────────

/**
 * Update (or insert if absent) a prompt part's content. Uses the key as the
 * stable business key; label is sourced from DEFAULT_PROMPT_PARTS on insert.
 * Admin-only.
 */
export async function updatePromptPart(
  key: PromptPartKey,
  content: string,
): Promise<ActionResult> {
  const user = await requireAdmin();

  if (!key) return actionFailure("invalid-input");

  const defaultPart = DEFAULT_PROMPT_PARTS.find((p) => p.key === key);
  const label = defaultPart?.label ?? key;

  try {
    await db
      .insert(promptParts)
      .values({
        key,
        label,
        content,
        updatedBy: user.id,
      })
      .onConflictDoUpdate({
        target: promptParts.key,
        set: {
          content,
          updatedBy: user.id,
        },
      });

    revalidatePath("/[locale]/admin/ai-studio/settings", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── resetPromptPart ───────────────────────────────────────────────────────────

/**
 * Reset a prompt part's content to the default from DEFAULT_PROMPT_PART_MAP.
 * Upserts so a row is always created if absent. Admin-only.
 *
 * Returns the restored default `content` on success so client callers can sync
 * their local textarea state — `router.refresh()` re-renders with fresh props
 * but preserves client state, so the UI cannot rely on a re-mount to pick the
 * new value up.
 */
export async function resetPromptPart(
  key: PromptPartKey,
): Promise<ActionResult & { content?: string }> {
  const user = await requireAdmin();

  if (!key) return actionFailure("invalid-input");

  const defaultContent = DEFAULT_PROMPT_PART_MAP[key];
  if (defaultContent === undefined) {
    return actionFailure("not-found", { cause: `no default for key: ${key}` });
  }

  const defaultPart = DEFAULT_PROMPT_PARTS.find((p) => p.key === key);
  const label = defaultPart?.label ?? key;

  try {
    await db
      .insert(promptParts)
      .values({
        key,
        label,
        content: defaultContent,
        updatedBy: user.id,
      })
      .onConflictDoUpdate({
        target: promptParts.key,
        set: {
          content: defaultContent,
          updatedBy: user.id,
        },
      });

    revalidatePath("/[locale]/admin/ai-studio/settings", "page");
    return { ok: true, content: defaultContent };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
