# Completing the new Scheme-of-Work rollout — design

**Date:** 2026-06-29
**Branch:** `feat/ai-studio-v2`
**Status:** approved (design); pending implementation plan

## Context

Commit `d6d670b` introduced a richer "Understanding by Design" (UbD) scheme-of-work
model: a typed `header_context` (transfer goal, enduring understandings, essential
questions, knowledge/skills, performance tasks, assessment plan) plus five metadata
columns on `schemes_of_work` (`main_competence`, `weeks_count`, `lessons_per_week`,
`lesson_duration_mins`, `total_lessons`).

An end-to-end audit (parse → store → generate → display → admin/tests) found the new
data is **captured well but acts on almost nothing downstream**:

- ✅ Schema, migrations (0001/0002), parser, and the upload→persist path are consistent.
  Both newly-supplied scheme docx files (`SOW-examples/grade2-arithmetic-sow.docx`,
  `SOW-examples/grade2-health-environment-sow.docx`) insert cleanly; `gradeNum`/`termOrdinal`
  are derived correctly on insert.
- ✅ `header_context` is formatted (`formatSchemeHeader`) and injected into the prompt by
  both the single (`/api/ai/generate`) and batch (`/api/ai/batch/lesson`) routes via the
  shared `assembleGeneration` → `buildPrompt` path.
- ❌ The five **metadata columns never reach generation** — parsed, stored, shown in
  admin, but `assembleGeneration`/`buildPrompt` never receive them. Lesson duration and
  pacing are not informed by the scheme.
- ❌ The **File-2 assessment plan is mis-parsed** — its formative/summative table is
  misrouted to `parseEvidence` and dumped into `performanceTasks`.
- 🟠 The **import surfaces are partial** — upload preview shows only 5 of 11 lesson
  columns, and the admin lesson edit form edits only 5; the other columns cannot be
  verified before saving or corrected after.

This spec covers the three slices chosen to close those gaps. Surfacing scheme context to
teachers / PDFs was explicitly deferred.

## Goals

1. Make the SOW metadata influence generation (awareness + authoritative lesson duration).
2. Parse the alternate "Acceptable Evidence" / assessment layout correctly (File 2 family).
3. Make scheme import trustworthy — verify all 11 columns on upload, edit all post-import.

## Non-goals

- Teacher-facing display of `header_context`/metadata on the lesson-detail page or PDF.
- Bulk PDF download (separate, unimplemented spec).
- Any change to the `header_context` shape, migrations, or the persisted DB schema.
- Adding a duration field to `structuredLessonPlanSchema` / the persisted plan (decided:
  pacing-in-prompt only; duration is not stored or displayed on the plan).
- Hard pacing rules / week-bound validation (the deeper "enforce" option was not chosen).

---

## Component A — Metadata drives generation

**Decision:** *Aware + pace-in-prompt only.* Inject the metadata as factual context so the
model sizes the teaching sequence to the right length. No persisted-field override.

**Important finding:** the lesson plan the routes actually generate and persist is
`structuredLessonPlanSchema` (→ `lesson_plans.content_json`), which has **no duration
field** (its `identifier` block is title/grade/subject/term/week/lesson_number/
main_competence/specific_competence). The `durationMinutes` field in `lessonPlanSchema.ts`
belonged to a different, route-unused schema (since deleted as dead code). We are **not** adding a duration field to the
canonical contract (decided). The user's intent — "a 30-min lesson is actually planned for
30 min" — is met entirely by pacing the model in the prompt.

### Data flow

Both routes already load the parent `schemes_of_work` row. Build a `schemeMeta` object
from it and thread it through the single shared assembly path:

```
route (generate | batch)
  └─ schemeMeta = { weeksCount, lessonsPerWeek, lessonDurationMins, totalLessons }
       └─ assembleGeneration(input + schemeMeta)
            └─ buildPrompt(input + schemeMeta)
                 └─ new "SCHEME PACING CONTEXT" section + task-template var
```

### Changes

- **`assembleGeneration.ts`** — add an optional `schemeMeta` field to
  `AssembleGenerationInput`; pass it straight to `buildPrompt`.
- **`buildPrompt.ts`** — add `schemeMeta` to `BuildPromptInput`. Insert a new ordered
  section, e.g.:
  `=== SCHEME PACING CONTEXT ===\nThis scheme runs 11 weeks · 2 lessons/week · 30 min per lesson. Total: 16 teaching lessons…`
  Built only from the non-empty fields; the whole section is **omitted when no metadata is
  present** (existing CSV/legacy schemes are unchanged). Expose `lessonDurationMins` as a
  `task_template` placeholder so the duration target reaches the task instruction (the
  model paces the teaching sequence to it).
- **`promptDefaults.ts`** — extend the default `task_template` to reference the duration
  placeholder; add any pacing wording needed.
- **Both routes** (`generate/route.ts`, `batch/lesson/route.ts`) — construct `schemeMeta`
  from the loaded scheme row and pass it into `assembleGeneration`. No post-generation
  override (no duration field exists to set).

### Edge cases

- No metadata on the scheme → no pacing section (today's behaviour).
- Metadata partially present → render only the known fields.
- Duration is conveyed only through the prompt; it is not persisted or displayed (out of
  scope per the decision — see Non-goals).

---

## Component B — Fix the assessment-plan parse (File 2 family)

**Root cause (confirmed):** `classifyTable` tests `/performance task/` (the "evidence"
rule) **before** the assessment rule. File 2's formative/summative table contains the
incidental phrase "…the School Compound Survey **performance task** is launched…", so the
entire assessment table is classified as `evidence` and `parseEvidence` sweeps all rows
into `performanceTasks`. `assessment` comes back `undefined`. File 1 is unaffected (no such
prose in its assessment table).

`parseAssessmentPlan` already handles File 2's real shape (row 0 = two section titles,
row 1 = sub-header with two `Type` columns at indices 0 and 4, rows 2+ = data) — it just
never receives the table.

### Changes

- **`parse.ts` `classifyTable`** — make assessment win over evidence:
  - Check the assessment rule (joined text contains **both** `formative` *and*
    `summative`) **before** the evidence rule, **or** restrict the evidence match to the
    section-title row (`row0`/`row1` first cell) rather than the whole joined blob.
  - Net effect: a table that is unambiguously a formative/summative plan is never stolen by
    the evidence classifier on incidental prose.
- **`parse.test.ts`** — add a File-2-shaped fixture and assert:
  - The performance-task table yields the real task in `performanceTasks` (not the
    assessment items).
  - The assessment table yields a populated `assessment.formative` / `assessment.summative`
    split.
  - Regression: a File-1-shaped fixture still classifies its assessment table as assessment.

---

## Component C — Trustworthy import (all 11 columns)

The 11 `sow_lessons` columns are: `week`, `lessonNumber`, `specificCompetence`,
`mainActivity`, `lessonObjective`, `knowledgeAndSkills`, `assessmentEvidence`,
`learningActivities`, `misconceptions`, `differentiationSupport`, `resources`,
`reflection`. (`rawCells` is provenance, not edited.)

### Changes

- **Upload preview** — expand the preview tables to show all 11 columns (currently 5) so a
  fresh import can be verified before saving:
  - `SchemesClient.tsx` admin preview table.
  - `SchemeLessonPanel.tsx` Studio review table.
- **Edit form** — `SchemesClient.tsx` lesson edit form: wire the 7 missing columns
  (`knowledgeAndSkills`, `assessmentEvidence`, `learningActivities`, `misconceptions`,
  `differentiationSupport`, `resources`, `reflection`) as textareas. The `upsertSowLesson`
  server action already accepts all 15 fields — this is purely a UI gap; no action/schema
  change.
- **i18n** — add the new column labels to `messages/en/lpmanage.json` and
  `messages/sw/lpmanage.json`.

### Note

Wide preview tables: keep the existing table layout but allow horizontal scroll / truncate
long cells with a title tooltip, consistent with the current preview styling. No new design
language.

---

## Testing strategy

- **B (highest value, pure):** parser unit tests in `parse.test.ts` as above.
- **A:** `buildPrompt` unit test — pacing section present when `schemeMeta` is supplied,
  absent when not; the task template receives the `lessonDurationMins` value.
- **C:** TypeScript typecheck + a manual verify pass — re-import both `SOW-examples/*.docx`
  through the admin upload flow and confirm (1) all 11 columns render in preview, (2) File
  2's assessment plan now splits into formative/summative rather than performance tasks,
  (3) the edit form round-trips the 7 newly-wired columns.

## Sequencing

`B → A → C`. B is isolated and confirms confidence in the two supplied test files; A is the
core functional win; C is UI. Each is a small, independently-committable change.

## Risks

- **Prompt drift (A):** adding a section changes the prompt for every generation. Mitigate
  by omitting the section entirely when no metadata is present, so only new-style schemes
  see the change, and by keeping the wording factual and short.
- **Classification regression (B):** reordering `classifyTable` could affect other
  templates. Mitigate with the File-1 regression assertion and by preferring the
  "both formative+summative" signal, which is specific to assessment tables.
- **DB usage in dev:** per project memory, do not run DB CLI scripts while `next dev` is
  up (PGlite single connection). Manual verify (C) uses the running app, not CLI scripts.
