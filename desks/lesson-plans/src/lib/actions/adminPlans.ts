"use server";

/**
 * Admin lesson-plan management server actions.
 *
 * Publish / unpublish / delete / edit a plan. Every action re-asserts admin
 * identity server-side via `requireAdmin()` (never trusts the caller) and
 * revalidates the admin plans listing so the table reflects the change on the
 * next render. Mutations that touch searchable content recompute the
 * denormalised `search_text` blob via the shared {@link buildSearchText}.
 */
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { lessonPlans, type PlanStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildSearchText } from "@/lib/lesson/searchText";
import {
  fetchPlansPage,
  PAGE_SIZE,
  type PlanFilters,
  type PlanRow,
} from "@/lib/admin/plansQuery";

/**
 * Route PATTERN to revalidate after any plan mutation. Every page lives under
 * the `[locale]` segment, so revalidation must target the filesystem route
 * pattern — a locale-less literal like "/admin/plans" matches nothing (see
 * the explanation in feedback.ts).
 */
const ADMIN_PLANS_PATH = "/[locale]/admin/plans";

export type { PlanStatus };

/** Result of the plan mutations below — UI maps the codes to i18n text. */
export type AdminActionResult = ActionResult;

/** Editable fields exposed by the admin edit form. All optional (partial PATCH). */
export interface UpdatePlanInput {
  title?: string;
  topic?: string | null;
  objectives?: string[];
  contentMarkdown?: string;
  durationMinutes?: number | null;
  status?: PlanStatus;
}

/**
 * Fetch the next batch of plans for the admin listing's "Show more" control.
 *
 * Re-asserts admin (never trusts the caller), then runs the same filtered,
 * canonically-ordered query the page uses. Fetches one extra row to tell the
 * client whether a further batch exists, without a second COUNT round-trip.
 */
export async function loadMorePlans(input: {
  filters: PlanFilters;
  offset: number;
}): Promise<{ rows: PlanRow[]; hasMore: boolean }> {
  await requireAdmin();

  const offset = Math.max(0, Math.trunc(input.offset) || 0);
  const rows = await fetchPlansPage(input.filters, {
    offset,
    limit: PAGE_SIZE + 1,
  });

  const hasMore = rows.length > PAGE_SIZE;
  return { rows: hasMore ? rows.slice(0, PAGE_SIZE) : rows, hasMore };
}

/** Flip a plan to `published`. */
export async function publishPlan(planId: string): Promise<AdminActionResult> {
  await requireAdmin();
  return setStatus(planId, "published");
}

/** Flip a plan back to `draft` (hides it from teachers). */
export async function unpublishPlan(
  planId: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  return setStatus(planId, "draft");
}

/** Shared status flip — also bumps `updated_at`. Not exported. */
async function setStatus(
  planId: string,
  status: PlanStatus,
): Promise<AdminActionResult> {
  if (!planId) return actionFailure("invalid-input");

  await db
    .update(lessonPlans)
    .set({ status })
    .where(eq(lessonPlans.id, planId));

  revalidatePath(ADMIN_PLANS_PATH, "page");
  return { ok: true };
}

/**
 * Permanently delete a plan.
 *
 * NOTE: related `plan_usage_events` / `plan_feedback` rows FK `plan_id`
 * without a cascade (`points_ledger.plan_id` is deliberately not an FK — see
 * the schema). In practice plans are normally unpublished rather than
 * deleted; if a delete hits a FK constraint the DB will reject it and we
 * surface a friendly error instead of crashing the action.
 */
export async function deletePlan(planId: string): Promise<AdminActionResult> {
  await requireAdmin();
  if (!planId) return actionFailure("invalid-input");

  try {
    await db.delete(lessonPlans).where(eq(lessonPlans.id, planId));
  } catch (err) {
    // Almost always an FK constraint from usage/feedback rows — the UI maps
    // "conflict" to a "unpublish it instead" message.
    return actionFailure("conflict", { cause: err });
  }

  revalidatePath(ADMIN_PLANS_PATH, "page");
  return { ok: true };
}

/**
 * Patch editable fields on a plan.
 *
 * Only provided keys are written. When any field that feeds search changes
 * (title / topic / objectives / content) we re-read the plan and recompute
 * `search_text` so full-text search stays in sync. Always bumps `updated_at`.
 *
 * NOTE: `contentMarkdown` is only what teachers see when `content_json` is
 * absent/invalid — for AI Studio v2 plans the teacher page renders the branded
 * document from `content_json`, so the edit page omits `contentMarkdown` from
 * its patch for those plans (see admin/plans/[slug]/edit).
 */
export async function updatePlan(
  planId: string,
  input: UpdatePlanInput,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!planId) return actionFailure("invalid-input");

  // Load current row so we can (a) validate it exists and (b) merge fields for
  // an accurate search_text recompute.
  const existing = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.id, planId))
    .limit(1);

  const plan = existing[0];
  if (!plan) return actionFailure("not-found");

  // `updated_at` is auto-bumped by the schema's $onUpdate, but an explicit
  // value keeps the UPDATE non-empty (and the "always bumps" contract intact)
  // when the caller provides no editable fields.
  const patch: Partial<typeof lessonPlans.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return actionFailure("invalid-input");
    patch.title = title;
  }
  if (input.topic !== undefined) {
    const topic = input.topic?.trim() ?? "";
    patch.topic = topic.length > 0 ? topic : null;
  }
  if (input.objectives !== undefined) {
    // Drop blank lines; store as a clean string[] (jsonb).
    patch.objectives = input.objectives
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }
  if (input.contentMarkdown !== undefined) {
    patch.contentMarkdown = input.contentMarkdown;
  }
  if (input.durationMinutes !== undefined) {
    patch.durationMinutes = input.durationMinutes;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }

  // Recompute the FTS blob when any contributing field changed.
  const searchFieldsTouched =
    input.title !== undefined ||
    input.topic !== undefined ||
    input.objectives !== undefined ||
    input.contentMarkdown !== undefined;

  if (searchFieldsTouched) {
    const mergedObjectives = patch.objectives ?? plan.objectives ?? [];

    patch.searchText = buildSearchText({
      subject: plan.subject,
      grade: plan.grade,
      term: plan.term,
      title: patch.title ?? plan.title,
      topic: patch.topic !== undefined ? patch.topic : plan.topic,
      objectives: mergedObjectives,
      contentMarkdown: patch.contentMarkdown ?? plan.contentMarkdown,
    });
  }

  await db.update(lessonPlans).set(patch).where(eq(lessonPlans.id, planId));

  revalidatePath(ADMIN_PLANS_PATH, "page");
  revalidatePath(`${ADMIN_PLANS_PATH}/[slug]/edit`, "page");
  return { ok: true };
}
