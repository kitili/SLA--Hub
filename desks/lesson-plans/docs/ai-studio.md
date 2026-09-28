# AI Studio architecture

Admin-only tooling under `/admin/ai-studio` that turns Scheme-of-Work (SOW)
lessons into full, structured lesson plans with an LLM (AI SDK v6 +
OpenRouter). Everything degrades gracefully when `OPENROUTER_API_KEY` is
unset: pages render, generation buttons explain why they are disabled.

## Pages / panels

| Route (under `/admin/ai-studio`) | Component | Purpose |
| --- | --- | --- |
| `/` | `AiStudioClient` | Single-plan Studio: stepper panels (Scheme & Lesson · Generate) + live streaming preview, structured editor, Save/Publish |
| `/batch` | `BatchClient` + `batchPool.ts` | Generate draft plans for many SOW lessons at once |
| `/schemes` | `SchemesClient` (+ `SchemeDetailView`, `SowUploadPanel`, `LessonEditForm`) | Upload (.docx via mammoth), review, and edit schemes of work |
| `/textbooks` | `TextbooksClient` | Upload textbook PDFs → durable OCR ingest into `textbook_pages` |
| `/settings` | `SettingsClient` + `PromptPartsEditor` | The generation model + the five `prompt_parts` rows; reset to defaults. Fronted by a warning — these change every plan generated afterwards |

Shared client plumbing: `useStudioCatalogs` (bootstraps the scheme list for
single + batch), `AiStudioNav`. i18n: the generation pages own the `lpStudio`
namespace (`messages/*/lpstudio.json`); scheme/textbook/settings management owns
`lpManage` (`messages/*/lpmanage.json`).

### The model and prompts are settings, not request inputs

Both live on `/settings` only. `/api/ai/generate` and `/api/ai/batch/lesson`
resolve them server-side — from `app_settings` via `resolveGenerationModelId`
(`src/lib/ai/modelSetting.ts`) and from `prompt_parts` via `assembleGeneration`
— and accept neither from the request body, so a crafted request cannot pick a
model or rewrite the prompt. They used to sit in the generation and batch UIs,
where prompt edits also rode along as ephemeral per-request `promptOverrides`
that were never persisted. Both the knobs and the override are gone.

The model layers: `app_settings['ai.generation_model']` → `AI_MODEL_ID` →
built-in default. The stored slug is allowlisted against `CURATED_MODELS` on
save *and* on read — the row outlives the code that validated it, so a slug
dropped from the list in a later release falls back instead of breaking
generation.

## Single-plan flow (streaming)

```
AiStudioClient ── POST /api/ai/generate ── streamObject(structuredLessonPlanSchema)
      │                                        │ (text stream of partial JSON)
      │◄───── accumulate chunks ───────────────┘
      ├─ parsePartial(buffer)          lib/ai/lessonPlan/parsePartial — repairs
      │                                truncated JSON; null until parseable
      ├─ applyKnownIdentifier(draft)   overwrite model-echoed grade/subject/term/
      │                                week/lesson with the app's own values
      ├─ validateLessonPlan(draft)     semantic guards (voice, MECE, checkpoints,
      │                                3 reflection questions)
      └─ savePlanStructured(plan, ctx) server action → lesson_plans row (draft or
                                       published) + ai_generations audit row
```

**Repair flow:** when validation issues remain, the UI offers *Repair* — it
re-POSTs `/api/ai/generate` with `repairIssues: string[]`, which
`buildPrompt` turns into a repair suffix appended to the prompt. The loop is
manual (admin-triggered), not automatic.

## Batch flow (foreground pool)

`BatchClient` seeds per-lesson state, then `runBatchPool` (a pure module,
unit-tested) drives N workers (default 4, max 8, ≤ 60 lessons/run) that each
call `POST /api/ai/batch/lesson` — the **non-streaming sibling** of
`/api/ai/generate`. The route loads the SOW row server-side, reuses the exact
same prompt assembly / schema / validation / save path, and always saves a
draft (`ignoreValidation: true` — issues are returned, not fatal).

Retry contract (status codes are the API): `400` bad input / no key → never
retry; `429` rate limit and `502` transient model error → retry with back-off
(`RETRY_BACKOFF_MS`, 2 attempts). Rate-limit detection is message-sniffing via
`isRateLimitMessage` (`src/lib/ai/model.ts`) — OpenRouter reports limits as
text.

**Batch is foreground-only: the tab must stay open.** Durable (Workflow
DevKit) batch generation was considered and **dropped** — each per-lesson
request is short enough for serverless limits, and the client pool reuses the
proven save path. The only durable workflow in the app is **textbook OCR
ingest** (`src/lib/ai/workflows/textbookIngest.ts`, `"use workflow"`), where a
run really is dozens of vision calls over many minutes. `startBatchRun` /
`finishBatchRun` (`src/lib/actions/aiBatch.ts`) bookend a batch with one
`ai_generations` audit row.

## Prompt assembly: `prompt_parts` vs `promptDefaults`

- `src/lib/ai/lessonPlan/promptDefaults.ts` — the **seed content** (pure
  module): five parts (`system`, `rules`, `blueprint`, `schema_note`,
  `task_template`) ported from the Antoine pipeline. Used by `db:seed` and by
  "reset to default" on the Settings tab.
- `prompt_parts` **table** — the live, admin-editable copies (one row per
  key), edited on `/settings`. `assembleGeneration` reads ALL rows and falls
  back to the default for a missing/empty part. These rows are the **only**
  source of prompt text: there is no per-request override.
- `assembleGeneration` (`src/lib/ai/lessonPlan/assembleGeneration.ts`) is the
  **single source of truth** both routes call: prompt parts + the labelled
  scheme-lesson blob (`buildSchemeLesson`) + scheme header/pacing meta →
  `buildPrompt` → `{ system, prompt }`.

## The naming/normalisation contract

`savePlanStructured` (`src/lib/actions/aiStudio.ts`) derives the canonical
filename/slug (`G7_Math_T1a_W1_L1`, see `src/lib/naming/`) from a caller
supplied `ctx` — grade gets a leading `G` added to bare digits (it cannot
parse display labels like `"Grade 2"`), term must be `1a|1b|2a|2b` (rejected
loudly otherwise), subject is TitleCased into one token
(`"Health and Environment"` → `"HealthAndEnvironment"`). That is why:

- the batch route passes `ctx.naming` from `loadSchemeLessonContext`, whose
  `grade` is the normalised `G<n>` token — **never** the scheme's raw label;
- `applyKnownIdentifier` overwrites the model-echoed identifier on BOTH paths
  (client preview and server save), so `content_json`/markdown can never
  disagree with the filename/slug.

## Module map (post-refactor homes)

| Concern | Lives in |
| --- | --- |
| Partial-JSON stream repair | `src/lib/ai/lessonPlan/parsePartial.ts` (pure, tested) |
| SOW row → prompt/naming context | `src/lib/ai/lessonPlan/loadSchemeContext.ts` (shared by both routes) |
| Identifier overwrite | `src/lib/ai/lessonPlan/identifier.ts` (pure, client + server) |
| Semantic validation | `src/lib/ai/lessonPlan/validate.ts` (pure) |
| Prompt assembly | `assembleGeneration.ts` → `buildPrompt.ts` (+ `promptDefaults.ts`) |
| Batch retry/pool engine | `src/app/[locale]/admin/ai-studio/batch/batchPool.ts` (pure, tested) |
| Markdown rendering of a plan | `src/lib/ai/lessonPlan/renderMarkdown.ts` |
| Model wiring / curated picker list | `src/lib/ai/model.ts` |
| Resolving the model from settings | `src/lib/ai/modelSetting.ts` (DB → env → default, allowlisted) |
| Save/publish actions | `src/lib/actions/aiStudio.ts` (single+batch save), `aiBatch.ts` (audit), `schemes.ts`, `textbooks.ts`, `prompts.ts`, `settings.ts` |
