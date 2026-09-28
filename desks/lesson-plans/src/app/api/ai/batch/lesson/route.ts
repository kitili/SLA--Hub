/**
 * POST /api/ai/batch/lesson — generate ONE lesson plan for a SOW lesson and
 * save it as a draft. The batch UI's bounded-concurrency pool calls this once
 * per selected lesson, several in flight at a time.
 *
 * This is the non-streaming sibling of `/api/ai/generate`: it reuses the exact
 * same prompt assembly (`assembleGeneration`), schema, validation, and save
 * path (`savePlanStructured`), so a batch plan is identical to one made
 * one-at-a-time in the Studio — only the transport differs (buffered
 * `generateObject` instead of `streamObject`). That includes resolving the
 * model and prompts server-side (admin Settings tab + `prompt_parts`) rather
 * than accepting them from the request body.
 *
 * Status codes drive the client's retry policy:
 *  - 400  bad input / no API key / deterministic save rejection → do NOT retry
 *  - 429  provider rate limit               → retry with back-off
 *  - 502  transient model / network error   → retry with back-off
 *  - 200  { ok, planId, slug, issues }      → saved (issues may be non-empty)
 *
 * Node runtime (NOT edge): auth, DB driver, and provider are server-only.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getModel, hasApiKey, isRateLimitMessage } from "@/lib/ai/model";
import { resolveGenerationModelId } from "@/lib/ai/modelSetting";
import { TERM_VALUES } from "@/lib/naming/constants";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";
import { assembleGeneration } from "@/lib/ai/lessonPlan/assembleGeneration";
import { loadSchemeLessonContext } from "@/lib/ai/lessonPlan/loadSchemeContext";
import { validateLessonPlan } from "@/lib/ai/lessonPlan/validate";
import { savePlanStructured } from "@/lib/actions/aiStudio";

/** Force the Node.js runtime — do not run on the edge. */
export const runtime = "nodejs";
/** Never cache; every request is a fresh generation. */
export const dynamic = "force-dynamic";
/** One plan can take a while; allow up to 60s where the platform honours it. */
export const maxDuration = 60;

/** Request body — validated with zod so bad input 400s with a clear message. */
const batchLessonBodySchema = z.object({
  /** The `sow_lessons` row to build a plan from. Required. */
  schemeLessonId: z.string().trim().min(1, "schemeLessonId is required."),
});

export async function POST(req: Request): Promise<Response> {
  await requireAdmin();

  if (!hasApiKey()) {
    return Response.json({ error: "OPENROUTER_API_KEY not set" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsedBody = batchLessonBodySchema.safeParse(raw);
  if (!parsedBody.success) {
    const detail = parsedBody.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    return Response.json(
      { error: `Invalid request body — ${detail}` },
      { status: 400 },
    );
  }
  const body = parsedBody.data;
  const schemeLessonId = body.schemeLessonId;

  // ── Load the SOW lesson + its parent scheme (shared loader) ──────────────
  const ctx = await loadSchemeLessonContext(schemeLessonId);
  if (!ctx) {
    return Response.json({ error: "SOW lesson not found." }, { status: 400 });
  }

  // ── Fail fast on deterministic naming problems ────────────────────────────
  // An unknown scheme term or a blank subject is rejected by
  // `savePlanStructured` AFTER generation — a paid 15-40s model call that can
  // never be saved, which the pool would then retry twice more. Catch it here
  // so a degenerate scheme costs zero model calls and returns a terminal 400.
  const term = ctx.naming.term.trim().toLowerCase();
  if (!TERM_VALUES.includes(term as (typeof TERM_VALUES)[number])) {
    return Response.json(
      {
        error: `Unrecognised scheme term "${ctx.naming.term}" — expected one of ${TERM_VALUES.join(", ")}. Fix the scheme's term, then retry.`,
      },
      { status: 400 },
    );
  }
  if (!ctx.naming.subject.trim()) {
    return Response.json(
      { error: "The scheme has no subject — set it before batch generation." },
      { status: 400 },
    );
  }

  // ── Assemble the prompt (shared with the streaming route) ─────────────────
  // `naming.grade` is the normalised `G<n>` token, so the task template reads
  // "this Grade G2 ... lesson" exactly like the single-plan Studio path
  // (the raw scheme label would render as "this Grade Grade 2 ... lesson").
  const { system, prompt } = await assembleGeneration({
    scheme: ctx.schemeInput,
    schemeHeader: ctx.schemeHeader,
    schemeMeta: ctx.schemeMeta,
    grade: ctx.naming.grade,
    subject: ctx.naming.subject,
    sourceIdx: ctx.sourceIdx,
  });

  // The model comes from the admin Settings tab, never the request body.
  const modelId = await resolveGenerationModelId();

  // ── Generate (buffered) ───────────────────────────────────────────────────
  let plan;
  try {
    const result = await generateObject({
      model: getModel(modelId),
      schema: structuredLessonPlanSchema,
      schemaName: "lesson_plan",
      schemaDescription: "A complete Tanzanian lesson plan.",
      system,
      prompt,
    });
    plan = result.object;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/batch/lesson] generateObject error:", message);
    return Response.json(
      { error: message },
      { status: isRateLimitMessage(message) ? 429 : 502 },
    );
  }

  // ── Validate (semantic guards) + save as draft ────────────────────────────
  const issues = validateLessonPlan(plan);

  const saved = await savePlanStructured(
    plan,
    {
      ...ctx.naming,
      modelId,
      schemeLessonId,
    },
    // Persist as a draft even with validation issues so nothing is lost; the UI
    // surfaces the issues so the admin can repair later.
    { publish: false, ignoreValidation: true },
  );

  if (!saved.ok) {
    // `message` is the authored safe detail (validation issues / naming
    // problems); the raw failure is already logged inside the action.
    // "invalid-input" is deterministic (naming/validation) — retrying would
    // burn another full paid generation on the same doomed input, so it maps
    // to the terminal 400; anything else stays a retryable 502.
    return Response.json(
      { error: saved.message ?? "Could not save the plan." },
      { status: saved.error === "invalid-input" ? 400 : 502 },
    );
  }

  return Response.json({
    ok: true,
    planId: saved.planId,
    slug: saved.slug,
    issues,
  });
}
