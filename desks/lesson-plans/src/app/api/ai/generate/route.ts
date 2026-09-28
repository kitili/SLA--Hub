/**
 * POST /api/ai/generate — stream a single AI-generated lesson plan (v2).
 *
 * Admin-only. Accepts a rich JSON body of SOW lesson context. Streams the
 * structured lesson-plan object as it is generated so the AI Studio UI can
 * render a live preview. Uses the AI SDK `streamObject` with the OpenRouter
 * provider; the response is the SDK's text stream of the partial JSON object
 * (`toTextStreamResponse()`), which the client accumulates and parses
 * progressively.
 *
 * The model and the prompts are resolved SERVER-SIDE — from the admin Settings
 * tab (`app_settings`) and the `prompt_parts` table respectively — and are
 * deliberately NOT accepted from the request body, so a crafted request cannot
 * pick the model or rewrite the prompt. Changing either is an admin action in
 * AI Studio → Settings.
 *
 * Prompt assembly (prompt parts, scheme-lesson blob) lives in the shared
 * `assembleGeneration` helper so this route and the batch worker
 * (`/api/ai/batch/lesson`) never drift.
 *
 * Node runtime (NOT edge): the auth layer, DB driver, and provider are
 * server-only.
 */
import { streamObject } from "ai";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getModel, hasApiKey } from "@/lib/ai/model";
import { resolveGenerationModelId } from "@/lib/ai/modelSetting";
import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";
import { assembleGeneration } from "@/lib/ai/lessonPlan/assembleGeneration";
import { loadSchemeLessonContext } from "@/lib/ai/lessonPlan/loadSchemeContext";
import type { SchemeMeta } from "@/lib/ai/lessonPlan/buildPrompt";

/** Force the Node.js runtime — do not run on the edge. */
export const runtime = "nodejs";
/** Never cache; every request is a fresh generation. */
export const dynamic = "force-dynamic";
/** Generation can take a while; allow up to 60s where the platform honours it. */
export const maxDuration = 60;

/** Per-lesson SOW columns — mirrors `SchemeInput` (assembleGeneration). */
const schemeInputSchema = z.object({
  grade: z.string().optional(),
  subject: z.string().optional(),
  term: z.string().optional(),
  week: z.union([z.string(), z.number()]).optional(),
  lessonNumber: z.union([z.string(), z.number()]).optional(),
  specificCompetence: z.string().optional(),
  mainActivity: z.string().optional(),
  lessonObjective: z.string().optional(),
  knowledgeAndSkills: z.string().optional(),
  assessmentEvidence: z.string().optional(),
  learningActivities: z.string().optional(),
  misconceptions: z.string().optional(),
  differentiationSupport: z.string().optional(),
  resources: z.string().optional(),
  reflection: z.string().optional(),
});

/**
 * All inputs the admin form / caller sends. Validated with zod so a malformed
 * body gets a 400 with a field-level message instead of degrading into an
 * empty-string prompt ("this Grade  lesson").
 */
const generateInputSchema = z.object({
  /** Optional SOW-lesson row id (used to load the parent scheme's header). */
  schemeLessonId: z.string().optional(),
  /** Per-lesson SOW columns (takes precedence over schemeLessonId for content). */
  scheme: schemeInputSchema.optional(),
  /** Shared scheme-of-work header (the "what & why" for the whole term). */
  schemeHeader: z.string().optional(),
  /** Target grade, e.g. "7" or "G7". Required. */
  grade: z.string().trim().min(1, "grade is required."),
  /** Target subject, e.g. "Math". Required. */
  subject: z.string().trim().min(1, "subject is required."),
  /** Source-lesson index within the scheme (for meta.source_lesson_idx). */
  sourceIdx: z.number().int().optional(),
  /** Validation issues from a previous failed attempt — triggers a repair suffix. */
  repairIssues: z.array(z.string()).optional(),
});

export async function POST(req: Request): Promise<Response> {
  await requireAdmin();

  if (!hasApiKey()) {
    return Response.json(
      { error: "OPENROUTER_API_KEY not set" },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsedInput = generateInputSchema.safeParse(raw);
  if (!parsedInput.success) {
    const detail = parsedInput.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    return Response.json(
      { error: `Invalid request body — ${detail}` },
      { status: 400 },
    );
  }
  const input = parsedInput.data;

  // Resolve the scheme header context. Prefer an explicit caller-supplied
  // string; otherwise, when a SOW lesson id is given, load its parent scheme's
  // formatted header + pacing metadata via the shared loader (single source of
  // truth with the batch route). The lesson's own columns are NOT taken from
  // the row here — the caller sends them (possibly edited) in `input.scheme`.
  let schemeMeta: SchemeMeta | undefined;
  let schemeHeader = input.schemeHeader;
  if (!schemeHeader && input.schemeLessonId) {
    const ctx = await loadSchemeLessonContext(input.schemeLessonId);
    if (ctx) {
      schemeHeader = ctx.schemeHeader;
      schemeMeta = ctx.schemeMeta;
    }
  }

  // Assemble the system + user prompt (prompt parts + scheme blob).
  const { system, prompt } = await assembleGeneration({
    scheme: input.scheme,
    schemeHeader,
    schemeMeta,
    grade: input.grade,
    subject: input.subject,
    sourceIdx: input.sourceIdx,
    repairIssues: input.repairIssues,
  });

  // Stream the structured object.
  const result = streamObject({
    model: getModel(await resolveGenerationModelId()),
    schema: structuredLessonPlanSchema,
    schemaName: "lesson_plan",
    schemaDescription: "A complete Tanzanian lesson plan.",
    system,
    prompt,
    onError({ error }) {
      console.error("[ai/generate] streamObject error:", error);
    },
  });

  // Stream the partial JSON object as text; the client parses it progressively.
  return result.toTextStreamResponse();
}
