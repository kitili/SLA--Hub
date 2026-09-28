"use server";

/**
 * AI Studio server actions — persist AI-generated lesson plans.
 *
 * Admin-only. `savePlanStructured` accepts a `StructuredLessonPlan` (the
 * schema produced by AI Studio v2) alongside explicit naming context that the
 * structured plan alone cannot always supply unambiguously. It derives the
 * canonical filename/slug from the naming fields, builds the FTS blob, inserts
 * a `lesson_plans` row, and writes an `ai_generations` audit row. Slug
 * collisions are resolved by suffixing.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import {
  aiGenerations,
  lessonPlans,
  schemesOfWork,
  sowLessons,
} from "@/lib/db/schema";
import { resolveGenerationModelId } from "@/lib/ai/modelSetting";
import { TERM_VALUES } from "@/lib/naming/constants";
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";
import { applyKnownIdentifier } from "@/lib/ai/lessonPlan/identifier";
import { validateLessonPlan } from "@/lib/ai/lessonPlan/validate";
import { renderLessonMarkdown } from "@/lib/ai/lessonPlan/renderMarkdown";
import { buildFilename } from "@/lib/naming/format";
import { parse } from "@/lib/naming/parse";
import { buildSearchText } from "@/lib/lesson/searchText";

/**
 * Save result. Failures carry an authored, user-safe `message` (validation
 * issues / naming problems) alongside the machine-readable code.
 */
export interface SavePlanResult
  extends ActionResult<"invalid-input" | "failed"> {
  slug?: string;
  planId?: string;
}

/** Does a plan with this slug already exist? */
async function slugExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: lessonPlans.id })
    .from(lessonPlans)
    .where(eq(lessonPlans.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/**
 * Find a free slug, suffixing `-2`, `-3`, … on collision. Bounded so a runaway
 * loop can't hang the request.
 */
async function resolveFreeSlug(baseSlug: string): Promise<string> {
  if (!(await slugExists(baseSlug))) return baseSlug;
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${baseSlug}-${n}`;
    if (!(await slugExists(candidate))) return candidate;
  }
  // Extremely unlikely; fall back to a timestamp suffix.
  return `${baseSlug}-${Date.now()}`;
}

/**
 * Period length (minutes) stored for a plan whose scheme states none — schemes
 * are only required to fill the metadata grid's Duration cell when it differs
 * from the school's usual period.
 */
const DEFAULT_LESSON_DURATION_MINS = 40;

/**
 * The period length stated by the scheme that owns `schemeLessonId`, or `null`
 * when the scheme states none (nullable column) or the lesson row is gone.
 *
 * Derived here rather than taken from the caller: the single-plan path invokes
 * this action straight from the Studio client, and the persisted duration must
 * come from the scheme itself, not from whatever the browser sends. Reading it
 * server-side also covers BOTH generation paths at once — the same reason
 * `applyKnownIdentifier` lives in this action.
 */
async function schemeLessonDuration(
  schemeLessonId: string,
): Promise<number | null> {
  const rows = await db
    .select({ mins: schemesOfWork.lessonDurationMins })
    .from(sowLessons)
    .innerJoin(schemesOfWork, eq(schemesOfWork.id, sowLessons.schemeId))
    .where(eq(sowLessons.id, schemeLessonId))
    .limit(1);
  return rows[0]?.mins ?? null;
}

/**
 * Naming context the caller must supply alongside the structured plan — these
 * fields drive filename/slug derivation and are not reliably extractable from
 * the plan's `identifier` alone (especially when the model fills them from
 * abbreviated inputs).
 */
export interface SavePlanStructuredCtx {
  /** Grade token, e.g. "7", "G7", or "G7". Leading "G" is added if absent. */
  grade: string;
  /** Subject token (TitleCase, no spaces), e.g. "Math". */
  subject: string;
  /** Term token, one of "1a" | "1b" | "2a" | "2b". */
  term: string;
  /** Week number within the term (1-based). */
  week: number;
  /** Lesson number within the week (1-based). */
  lesson: number;
  /**
   * OpenRouter model slug that produced this plan. Omit to record the model
   * resolved from the admin Settings tab; the batch route passes the id it
   * already resolved for its own call. Never accept this from a client.
   */
  modelId?: string;
  /** SOW lesson row this plan was generated from. */
  schemeLessonId?: string;
}

/** Options for `savePlanStructured`. */
export interface SavePlanStructuredOpts {
  /** Store the plan as `published`; default is `draft`. */
  publish?: boolean;
  /**
   * Skip the semantic validation guard and persist the plan regardless of
   * issues. Use sparingly — mainly for "repair + save" flows where the
   * caller has already inspected the issues.
   */
  ignoreValidation?: boolean;
}

/**
 * Persist a v2 structured plan (`StructuredLessonPlan`) as a `lesson_plans`
 * row plus an `ai_generations` audit row.
 *
 *  - runs `validateLessonPlan` before inserting (unless `ignoreValidation`);
 *  - overwrites the model-echoed identifier coordinates with `ctx` (see
 *    `identifier.ts`) so both generation paths persist the app's own values;
 *  - renders Markdown via `renderLessonMarkdown`;
 *  - stores the period length stated by the plan's scheme, falling back to
 *    `DEFAULT_LESSON_DURATION_MINS`;
 *  - writes v2 provenance columns (`contentJson`, `schemeLessonId`, `modelId`).
 *
 * @param plan   The structured plan produced by the v2 generation route.
 * @param ctx    Naming context (grade, subject, term, week, lesson, …).
 * @param opts   `publish` / `ignoreValidation` flags.
 */
export async function savePlanStructured(
  plan: StructuredLessonPlan,
  ctx: SavePlanStructuredCtx,
  opts?: SavePlanStructuredOpts,
): Promise<SavePlanResult> {
  const user = await requireAdmin();

  // Semantic validation (Zod + voice/MECE/checkpoint/reflection guards).
  const issues = validateLessonPlan(plan);
  if (issues.length > 0 && !opts?.ignoreValidation) {
    return actionFailure("invalid-input", { message: issues.join("; ") });
  }

  // Normalise naming parts for filename derivation.
  // Grade: ensure leading "G" (bare digits → "G<n>").
  const gradeRaw = ctx.grade.trim();
  const grade = /^\d/.test(gradeRaw) ? `G${gradeRaw}` : gradeRaw;

  // Term: lowercase + validate against TERM_VALUES. An unrecognised term is
  // rejected loudly — silently defaulting would file the whole plan (slug,
  // filename, search facets) under the wrong term with no warning anywhere.
  const term = ctx.term.trim().toLowerCase();
  if (!TERM_VALUES.includes(term as (typeof TERM_VALUES)[number])) {
    return actionFailure("invalid-input", {
      message: `Unrecognised term "${ctx.term}" — expected one of ${TERM_VALUES.join(", ")}.`,
    });
  }

  // Subject: single TitleCase token (strip spaces, title-case each word) —
  // e.g. "Health and Environment" -> "HealthAndEnvironment", not
  // "Healthandenvironment". Title-casing only the very first character would
  // blend lowercase words like "and" into their neighbours and make
  // multi-word subjects unreadable everywhere the token is displayed.
  const subject = ctx.subject
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const filename = buildFilename({
    grade,
    subject,
    term,
    week: ctx.week,
    lesson: ctx.lesson,
  });

  const parsed = parse(filename);
  if (!parsed.ok) {
    return actionFailure("invalid-input", { message: parsed.reason });
  }

  // Overwrite the model-echoed identifier coordinates with the authoritative
  // naming context (see identifier.ts) so the stored content_json and the
  // rendered markdown header can never disagree with the filename/slug —
  // this covers BOTH the single-plan and the batch generation paths.
  const normalizedPlan = applyKnownIdentifier(plan, {
    grade,
    subject,
    term,
    week: ctx.week,
    lesson: ctx.lesson,
  });

  const contentMarkdown = renderLessonMarkdown(normalizedPlan);
  const searchText = buildSearchText({
    subject,
    grade,
    term,
    title: normalizedPlan.identifier.title,
    topic: normalizedPlan.identifier.specific_competence,
    objectives: normalizedPlan.success_criteria,
    contentMarkdown,
  });

  const status = opts?.publish ? "published" : "draft";

  try {
    const { value } = parsed;
    const slug = await resolveFreeSlug(value.slug);

    // Which model produced this plan. The batch route passes the id it already
    // resolved for its own generateObject call; the single-plan path omits it,
    // so we resolve the Settings value here. Never taken from the client.
    const modelId = ctx.modelId ?? (await resolveGenerationModelId());

    // Each scheme states its own period length, so a plan generated from a
    // 30-minute scheme must not claim the 40 this used to hardcode (the value
    // renders on the plan detail page via `formatPlanMeta`).
    const durationMinutes = ctx.schemeLessonId
      ? ((await schemeLessonDuration(ctx.schemeLessonId)) ??
        DEFAULT_LESSON_DURATION_MINS)
      : DEFAULT_LESSON_DURATION_MINS;

    const planId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(lessonPlans)
        .values({
          slug,
          filename,
          grade: value.grade,
          gradeNum: value.gradeNum,
          subject: value.subject,
          term: value.term,
          termOrdinal: value.termOrdinal,
          week: value.week,
          lesson: value.lesson,
          title: normalizedPlan.identifier.title,
          topic: normalizedPlan.identifier.specific_competence,
          objectives: normalizedPlan.success_criteria,
          durationMinutes,
          contentMarkdown,
          contentJson: normalizedPlan,
          status,
          source: "ai",
          createdBy: user.id,
          searchText,
          modelId,
          schemeLessonId: ctx.schemeLessonId,
        })
        .returning();

      const newId = inserted[0]?.id;

      await tx.insert(aiGenerations).values({
        requestedBy: user.id,
        mode: "single",
        modelId,
        inputParams: { ...ctx },
        status: "succeeded",
        resultPlanIds: newId ? [newId] : [],
        completedAt: new Date(),
      });

      return newId;
    });

    // Refresh views that include this plan. Route PATTERNS, not literals:
    // every page lives under the `[locale]` segment, so a locale-less literal
    // like "/search" matches nothing (see the explanation in feedback.ts).
    revalidatePath("/[locale]/admin/ai-studio", "page");
    revalidatePath("/[locale]/search", "page");
    revalidatePath("/[locale]/plans/[slug]", "page");

    return { ok: true, slug, planId };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
