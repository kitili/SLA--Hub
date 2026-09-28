# Completing the new Scheme-of-Work rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the new UbD scheme-of-work data act downstream — pace generation by the scheme metadata, parse the alternate formative/summative assessment layout correctly, and let admins verify/edit all 11 lesson columns on import.

**Architecture:** Three independent slices. (B) A pure-parser classification fix. (A) Thread a new optional `schemeMeta` through the single shared `assembleGeneration → buildPrompt` path and the two AI routes, injecting a "pacing context" prompt section. (C) Surface all 11 `sow_lessons` columns in the admin upload preview, the Studio review table, and the admin lesson edit form. No DB schema or migration changes; no change to the persisted lesson-plan contract.

**Tech Stack:** Next.js (App Router), TypeScript, Drizzle ORM, Vitest, next-intl, Vercel AI SDK (`streamObject`/`generateObject`), mammoth (docx→HTML).

**Spec:** `docs/superpowers/specs/2026-06-29-sow-rollout-completion-design.md`

**Sequencing:** B → A → C. Each task ends in a commit.

**Commands:**
- Run one test file: `npx vitest run src/lib/sow/parse.test.ts`
- Run all tests: `npm run test`
- Typecheck: `npm run typecheck`

> **Dev-DB note (project memory):** do not run DB CLI scripts while `next dev` is up (PGlite single connection). The only manual step here drives the running app through the browser, not CLI scripts.

---

## Task B1: Fix assessment-table classification (parser)

The bug: `classifyTable` tests the evidence rule (`/performance task/`) before the assessment rule. File 2's formative/summative table contains the incidental phrase "…the School Compound Survey performance task is launched…", so the whole table is misrouted to `parseEvidence` and `assessment` comes back `undefined`. Fix: let the assessment rule (a table containing **both** "formative" and "summative") win first.

**Files:**
- Modify: `src/lib/sow/parse.ts:237-255` (`classifyTable`)
- Test: `src/lib/sow/parse.test.ts`

- [ ] **Step 1: Write the failing test**

Add this fixture next to the other table fixtures in `src/lib/sow/parse.test.ts` (after `EVIDENCE_TABLE`, around line 131). It reproduces File 2's shape: a two-column section-title row, an 8-cell sub-header with two `Type` columns, and data rows — including the incidental "performance task" phrase that triggers the bug.

```ts
const ASSESSMENT_TABLE = htmlTable([
  ["Formative Assessments (collected throughout)", "Summative Assessments (end of unit)"],
  ["Type", "What learner does", "Assesses", "When", "Type", "Details", "Assesses", "When"],
  ["EXIT TICKETS", "A five-question ticket", "the day's content", "every lesson", "BASELINE ASSESSMENT", "A full written paper", "prior knowledge", "Week 1"],
  ["MONTHLY ASSESSMENTS", "the School Compound Survey performance task is launched", "weeks 2-6", "Week 7", "MID-TERM EXAM", "A 20-mark paper", "all objectives", "Week 11"],
]);
```

Then add this `describe` block after the "desired results" block (around line 171):

```ts
describe("parseSowHtml — assessment plan vs evidence", () => {
  it("routes a formative/summative table to the assessment plan, not performance tasks", () => {
    const { headerContext: ctx } = parseSowHtml(
      META_TABLE + EVIDENCE_TABLE + ASSESSMENT_TABLE,
    );
    // The real performance task stays in performanceTasks…
    expect(ctx.performanceTasks.some((t) => /Market Stall/.test(t))).toBe(true);
    // …and the assessment items are NOT swept into performanceTasks.
    expect(ctx.performanceTasks.some((t) => /EXIT TICKETS/.test(t))).toBe(false);
    // The formative/summative split is populated.
    expect(ctx.assessment).toBeDefined();
    expect(ctx.assessment?.formative.some((f) => /EXIT TICKETS/.test(f))).toBe(true);
    expect(ctx.assessment?.summative.some((s) => /BASELINE ASSESSMENT/.test(s))).toBe(true);
  });

  it("still classifies the evidence table as performance tasks (regression)", () => {
    const { headerContext: ctx } = parseSowHtml(META_TABLE + EVIDENCE_TABLE);
    expect(ctx.performanceTasks.some((t) => /Market Stall/.test(t))).toBe(true);
    expect(ctx.assessment).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sow/parse.test.ts -t "assessment plan vs evidence"`
Expected: the first test FAILS — `ctx.assessment` is `undefined` and `performanceTasks` contains "EXIT TICKETS" (table misrouted to evidence).

- [ ] **Step 3: Implement the fix**

In `src/lib/sow/parse.ts`, reorder `classifyTable` so the assessment rule is checked **before** the evidence rule. Replace the body of `classifyTable` (lines 237-255) with:

```ts
function classifyTable(table: string[][]): TableKind {
  const row0first = table[0]?.[0] ?? "";
  if (/^\s*week\b/i.test(row0first)) return "week";

  const joined = table.flat().join("  ").toLowerCase();
  if (/desired results/.test(joined) || /enduring understanding/.test(joined)) {
    return "desired";
  }
  // Assessment BEFORE evidence: a table carrying BOTH a formative and a
  // summative section is unambiguously the assessment plan, even when its prose
  // mentions a "performance task" in passing (which would otherwise let the
  // evidence rule steal it).
  if (/formative assessment/.test(joined) && /summative/.test(joined)) {
    return "assessment";
  }
  if (/acceptable evidence/.test(joined) || /performance task/.test(joined)) {
    return "evidence";
  }
  if (/\bgrade\b/.test(joined) && /main competence|subject|\bterm\b/.test(joined)) {
    return "meta";
  }
  return "other";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/sow/parse.test.ts`
Expected: PASS — both new tests pass and all pre-existing parse tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sow/parse.ts src/lib/sow/parse.test.ts
git commit -m "fix(sow): classify formative/summative tables as assessment, not evidence

A table whose prose mentions a 'performance task' was misrouted to
parseEvidence, dropping the formative/summative split. Check the
assessment rule (needs both formative + summative) before the evidence
rule. Affects schemes using the Health/Environment evidence layout.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A1: Add `schemeMeta` pacing context to `buildPrompt`

Introduce an optional `SchemeMeta` and render a "SCHEME PACING CONTEXT" section. The section is omitted entirely when no metadata is present, so existing/CSV schemes are unchanged. Duration guidance is conveyed inside this section (the persisted plan has no duration field, and `task_template` is intentionally left untouched to avoid dangling `{{…}}` placeholders).

**Files:**
- Modify: `src/lib/ai/lessonPlan/buildPrompt.ts`
- Test: `src/lib/ai/lessonPlan/lessonPlan.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/ai/lessonPlan/lessonPlan.test.ts`, inside the existing `describe("buildPrompt", …)` block (after the textbook tests, around line 330+), add:

```ts
  it("includes a SCHEME PACING CONTEXT section when schemeMeta is provided", () => {
    const { prompt } = buildPrompt({
      ...baseInput,
      schemeMeta: {
        weeksCount: 11,
        lessonsPerWeek: 2,
        lessonDurationMins: 30,
        totalLessons: "16 teaching lessons",
      },
    });
    expect(prompt).toContain("=== SCHEME PACING CONTEXT ===");
    expect(prompt).toContain("11 weeks");
    expect(prompt).toContain("2 lessons/week");
    expect(prompt).toContain("30-minute period");
  });

  it("omits the pacing context section when schemeMeta is absent", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).not.toContain("=== SCHEME PACING CONTEXT ===");
  });

  it("renders only the known pacing fields", () => {
    const { prompt } = buildPrompt({
      ...baseInput,
      schemeMeta: { lessonDurationMins: 40 },
    });
    expect(prompt).toContain("=== SCHEME PACING CONTEXT ===");
    expect(prompt).toContain("40-minute period");
    expect(prompt).not.toContain("lessons/week");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ai/lessonPlan/lessonPlan.test.ts -t "PACING"`
Expected: FAIL — `schemeMeta` is not a known property and no pacing section is emitted.

- [ ] **Step 3: Implement `SchemeMeta`, the formatter, and the section**

In `src/lib/ai/lessonPlan/buildPrompt.ts`:

(a) Add the exported interface after `TextbookContext` (after line 25):

```ts
/** Optional scheme-level pacing metadata for the generation prompt. */
export interface SchemeMeta {
  weeksCount?: number | null;
  lessonsPerWeek?: number | null;
  lessonDurationMins?: number | null;
  totalLessons?: string | null;
}
```

(b) Add `schemeMeta` to `BuildPromptInput` (after the `subject` field, around line 40):

```ts
  /** Optional scheme pacing metadata (weeks, lessons/week, duration, total). */
  schemeMeta?: SchemeMeta;
```

(c) Add this formatter just above `buildPrompt` (before line 99):

```ts
/**
 * Build the "scheme pacing context" body from the non-empty metadata fields.
 * Returns "" when nothing is known so the section can be omitted entirely.
 */
function formatPacingContext(meta: SchemeMeta | undefined): string {
  if (!meta) return "";
  const runBits: string[] = [];
  if (meta.weeksCount != null) runBits.push(`${meta.weeksCount} weeks`);
  if (meta.lessonsPerWeek != null) runBits.push(`${meta.lessonsPerWeek} lessons/week`);
  if (meta.lessonDurationMins != null) runBits.push(`${meta.lessonDurationMins} min per lesson`);

  const lines: string[] = [];
  if (runBits.length > 0) lines.push(`This scheme runs ${runBits.join(" · ")}.`);
  if (meta.totalLessons) lines.push(`Scheme total: ${meta.totalLessons}.`);
  if (meta.lessonDurationMins != null) {
    lines.push(
      `Plan this single lesson to fit one ${meta.lessonDurationMins}-minute period: ` +
        `size the teaching sequence (hook, I do, we do, you do) and the exit ticket to that time.`,
    );
  }
  return lines.join(" ");
}
```

(d) Destructure `schemeMeta` in `buildPrompt` (extend the destructure on line 100):

```ts
  const { parts, schemeHeader, schemeLesson, textbook, grade, subject, sourceIdx, repairIssues, schemeMeta } = input;
```

(e) Insert the pacing section immediately after the scheme-header section push (after line 124, before the "Scheme lesson" section):

```ts
  // 4b. Scheme pacing context (optional — omitted when no metadata is known).
  const pacing = formatPacingContext(schemeMeta);
  if (pacing) {
    sections.push("=== SCHEME PACING CONTEXT ===\n" + pacing);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ai/lessonPlan/lessonPlan.test.ts`
Expected: PASS — the three new tests pass and the existing buildPrompt tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/lessonPlan/buildPrompt.ts src/lib/ai/lessonPlan/lessonPlan.test.ts
git commit -m "feat(sow): add scheme pacing context to the generation prompt

buildPrompt now accepts an optional schemeMeta and renders a
'SCHEME PACING CONTEXT' section (weeks, lessons/week, duration, total),
instructing the model to size the lesson to the period length. The
section is omitted when no metadata is present.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A2: Thread `schemeMeta` through `assembleGeneration` and both routes

**Files:**
- Modify: `src/lib/ai/lessonPlan/assembleGeneration.ts`
- Modify: `src/app/api/ai/batch/lesson/route.ts:88-145`
- Modify: `src/app/api/ai/generate/route.ts:83-111`

- [ ] **Step 1: Extend `assembleGeneration`**

In `src/lib/ai/lessonPlan/assembleGeneration.ts`:

(a) Extend the `buildPrompt` import (line 20-21) to also bring in the type:

```ts
import { buildPrompt } from "@/lib/ai/lessonPlan/buildPrompt";
import type { TextbookContext, SchemeMeta } from "@/lib/ai/lessonPlan/buildPrompt";
```

(b) Add `schemeMeta` to `AssembleGenerationInput` (after the `schemeHeader` field, around line 52):

```ts
  /** Optional scheme pacing metadata (weeks, lessons/week, duration, total). */
  schemeMeta?: SchemeMeta;
```

(c) Pass it through in the `buildPrompt` call (inside the returned object, after `schemeHeader`, around line 186):

```ts
    schemeMeta: input.schemeMeta,
```

- [ ] **Step 2: Wire the batch route**

In `src/app/api/ai/batch/lesson/route.ts`, the full `scheme` row is already loaded (line 88-93). Build `schemeMeta` from it and pass it to `assembleGeneration`. Add this right after the `schemeHeader` assignment (after line 122):

```ts
  // Scheme pacing metadata (weeks, lessons/week, duration, total) → prompt.
  const schemeMeta = {
    weeksCount: scheme.weeksCount,
    lessonsPerWeek: scheme.lessonsPerWeek,
    lessonDurationMins: scheme.lessonDurationMins,
    totalLessons: scheme.totalLessons,
  };
```

Then add `schemeMeta,` to the `assembleGeneration({ … })` call (after `schemeHeader,` on line 139):

```ts
  const { system, prompt } = await assembleGeneration({
    scheme: schemeInput,
    schemeHeader,
    schemeMeta,
    grade: scheme.grade,
    subject: scheme.subject,
    sourceIdx: lesson.orderIndex,
    textbookPageIds,
    promptOverrides: body.promptOverrides,
  });
```

- [ ] **Step 3: Wire the generate (streaming) route**

In `src/app/api/ai/generate/route.ts`, the scheme is only loaded (for its header) inside the `if (!schemeHeader && input.schemeLessonId)` block, and the `select` fetches only `headerContext`. Widen that select to also fetch the metadata and capture it.

(a) Add the type import alongside the existing imports near the top (next to the other `@/lib/ai/lessonPlan` imports):

```ts
import type { SchemeMeta } from "@/lib/ai/lessonPlan/buildPrompt";
```

(b) Declare `schemeMeta` just before the resolve block (before line 83):

```ts
  let schemeMeta: SchemeMeta | undefined;
```

(c) Replace the scheme `select` + header assignment (lines 92-97) with a widened select that also captures the metadata:

```ts
      const schemeRows = await db
        .select({
          headerContext: schemesOfWork.headerContext,
          weeksCount: schemesOfWork.weeksCount,
          lessonsPerWeek: schemesOfWork.lessonsPerWeek,
          lessonDurationMins: schemesOfWork.lessonDurationMins,
          totalLessons: schemesOfWork.totalLessons,
        })
        .from(schemesOfWork)
        .where(eq(schemesOfWork.id, schemeId))
        .limit(1);
      schemeHeader = formatSchemeHeader(schemeRows[0]?.headerContext);
      if (schemeRows[0]) {
        schemeMeta = {
          weeksCount: schemeRows[0].weeksCount,
          lessonsPerWeek: schemeRows[0].lessonsPerWeek,
          lessonDurationMins: schemeRows[0].lessonDurationMins,
          totalLessons: schemeRows[0].totalLessons,
        };
      }
```

(d) Add `schemeMeta,` to the `assembleGeneration({ … })` call (after `schemeHeader,` on line 104):

```ts
  const { system, prompt } = await assembleGeneration({
    scheme: input.scheme,
    schemeHeader,
    schemeMeta,
    grade: input.grade,
    subject: input.subject,
    sourceIdx: input.sourceIdx,
    textbookPageIds: input.textbookPageIds,
    promptOverrides: input.promptOverrides,
    repairIssues: input.repairIssues,
  });
```

> Note: when a caller supplies `schemeHeader` explicitly (so the scheme is not loaded), `schemeMeta` stays undefined and no pacing section is rendered — acceptable; the scheme-lesson generation path (the one that needs pacing) always loads the scheme.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors. (`scheme.weeksCount` etc. are `number | null`, which matches `SchemeMeta`.)

- [ ] **Step 5: Run the test suite (no regressions)**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/lessonPlan/assembleGeneration.ts src/app/api/ai/batch/lesson/route.ts src/app/api/ai/generate/route.ts
git commit -m "feat(sow): pass scheme pacing metadata into both generation routes

Both the streaming and batch routes now build a schemeMeta from the
parent scheme (weeks, lessons/week, duration, total) and pass it through
assembleGeneration so the pacing context reaches the prompt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C1: Add i18n labels for the 7 extra lesson columns

**Files:**
- Modify: `messages/en/lpmanage.json`
- Modify: `messages/sw/lpmanage.json`

- [ ] **Step 1: Locate the `lessonColumns` block**

Run: `grep -n "lessonColumns" messages/en/lpmanage.json messages/sw/lpmanage.json`
This object currently holds `week`, `lesson`, `competence`, `activity`, `objective`, `actions`.

- [ ] **Step 2: Add the new keys (English)**

In `messages/en/lpmanage.json`, add these keys inside the `lessonColumns` object (keep existing keys; add the seven):

```json
"knowledgeSkills": "Knowledge & skills",
"assessmentEvidence": "Assessment / evidence",
"learningActivities": "Learning activities",
"misconceptions": "Misconceptions",
"differentiation": "Differentiation / support",
"resources": "Resources",
"reflection": "Reflection"
```

- [ ] **Step 3: Add the new keys (Swahili)**

In `messages/sw/lpmanage.json`, add the matching keys inside `lessonColumns`:

```json
"knowledgeSkills": "Maarifa na stadi",
"assessmentEvidence": "Tathmini / ushahidi",
"learningActivities": "Shughuli za kujifunza",
"misconceptions": "Dhana potofu",
"differentiation": "Utofautishaji / msaada",
"resources": "Rasilimali",
"reflection": "Tafakari"
```

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "require('./messages/en/lpmanage.json'); require('./messages/sw/lpmanage.json'); console.log('ok')"`
Expected: prints `ok` (no JSON parse error / trailing-comma mistake).

- [ ] **Step 5: Commit**

```bash
git add messages/en/lpmanage.json messages/sw/lpmanage.json
git commit -m "i18n(sow): add labels for the 7 extra SOW lesson columns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C2: Edit all 11 columns in the admin lesson edit form

Wire the 7 missing columns into `LessonEditForm`. The `upsertSowLesson` action already accepts all of them — this is purely UI state + inputs.

**Files:**
- Modify: `src/app/[locale]/admin/ai-studio/schemes/SchemesClient.tsx:210-291`

- [ ] **Step 1: Add state for the 7 columns**

In `LessonEditForm`, after the `objective` state (line 214), add:

```ts
  const [knowledgeSkills, setKnowledgeSkills] = useState(lesson?.knowledgeAndSkills ?? "");
  const [assessmentEvidence, setAssessmentEvidence] = useState(lesson?.assessmentEvidence ?? "");
  const [learningActivities, setLearningActivities] = useState(lesson?.learningActivities ?? "");
  const [misconceptions, setMisconceptions] = useState(lesson?.misconceptions ?? "");
  const [differentiation, setDifferentiation] = useState(lesson?.differentiationSupport ?? "");
  const [resources, setResources] = useState(lesson?.resources ?? "");
  const [reflection, setReflection] = useState(lesson?.reflection ?? "");
```

- [ ] **Step 2: Include them in the upsert payload**

In `handleSave`, extend the `input` object (after `lessonObjective: objective || null,` on line 227):

```ts
        knowledgeAndSkills: knowledgeSkills || null,
        assessmentEvidence: assessmentEvidence || null,
        learningActivities: learningActivities || null,
        misconceptions: misconceptions || null,
        differentiationSupport: differentiation || null,
        resources: resources || null,
        reflection: reflection || null,
```

- [ ] **Step 3: Render the 7 textareas**

After the existing `objective` `<label>` block (after line 291, before the `{error ? …}` line), add:

```tsx
      <label className={styles.fieldLabel}>
        {t("lessonColumns.knowledgeSkills")}
        <textarea className={styles.textarea} value={knowledgeSkills}
          onChange={(e) => setKnowledgeSkills(e.target.value)} rows={2} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.assessmentEvidence")}
        <textarea className={styles.textarea} value={assessmentEvidence}
          onChange={(e) => setAssessmentEvidence(e.target.value)} rows={2} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.learningActivities")}
        <textarea className={styles.textarea} value={learningActivities}
          onChange={(e) => setLearningActivities(e.target.value)} rows={3} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.misconceptions")}
        <textarea className={styles.textarea} value={misconceptions}
          onChange={(e) => setMisconceptions(e.target.value)} rows={2} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.differentiation")}
        <textarea className={styles.textarea} value={differentiation}
          onChange={(e) => setDifferentiation(e.target.value)} rows={2} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.resources")}
        <textarea className={styles.textarea} value={resources}
          onChange={(e) => setResources(e.target.value)} rows={2} disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        {t("lessonColumns.reflection")}
        <textarea className={styles.textarea} value={reflection}
          onChange={(e) => setReflection(e.target.value)} rows={2} disabled={pending} />
      </label>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`SowLesson` carries all these fields; `UpsertSowLessonInput` accepts them.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/admin/ai-studio/schemes/SchemesClient.tsx"
git commit -m "feat(sow): edit all 11 SOW lesson columns in the admin form

The edit form previously exposed only 5 of the 11 sow_lessons columns;
wire the remaining 7 (knowledge & skills, assessment/evidence, learning
activities, misconceptions, differentiation, resources, reflection) as
textareas. upsertSowLesson already accepts them.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C3: Show all 11 columns in the upload preview + Studio review tables

So a freshly-parsed scheme can be fully verified before saving.

**Files:**
- Modify: `src/app/[locale]/admin/ai-studio/schemes/SchemesClient.tsx:750-771` (upload preview table)
- Modify: `src/app/[locale]/admin/ai-studio/SchemeLessonPanel.tsx:33-39, 178-186, 314-333` (review table + `PreviewRow` type)

- [ ] **Step 1: Expand the SchemesClient upload-preview table**

In `src/app/[locale]/admin/ai-studio/schemes/SchemesClient.tsx`, the upload-preview table header (lines 753-757) currently lists week/lesson/competence/activity/objective. Add the 7 columns to the `<thead>` row (after the `objective` `<th>`):

```tsx
                      <th>{t("lessonColumns.knowledgeSkills")}</th>
                      <th>{t("lessonColumns.assessmentEvidence")}</th>
                      <th>{t("lessonColumns.learningActivities")}</th>
                      <th>{t("lessonColumns.misconceptions")}</th>
                      <th>{t("lessonColumns.differentiation")}</th>
                      <th>{t("lessonColumns.resources")}</th>
                      <th>{t("lessonColumns.reflection")}</th>
```

And in the body row (after `<td>{row.lessonObjective ?? "—"}</td>`, around line 766) add, using the existing `styles.cellClamp` for long text:

```tsx
                        <td className={styles.cellClamp}>{row.knowledgeAndSkills ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.assessmentEvidence ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.learningActivities ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.misconceptions ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.differentiationSupport ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.resources ?? "—"}</td>
                        <td className={styles.cellClamp}>{row.reflection ?? "—"}</td>
```

(`previewRows` is typed `ParsedSowRow[]`, which already carries all these fields, so no type change here.)

- [ ] **Step 2: Ensure the wide preview table can scroll**

Confirm the preview table sits in a horizontally scrollable wrapper. Run:

`grep -n "overflow" src/app/[locale]/admin/ai-studio/schemes/SchemesClient.module.css`

If the `.table` (or its wrapper) has no `overflow-x`, wrap the `<table>` at line 750 in:

```tsx
<div style={{ overflowX: "auto" }}>
  {/* existing <table>…</table> */}
</div>
```

- [ ] **Step 3: Extend the Studio `SchemeLessonPanel` review table**

In `src/app/[locale]/admin/ai-studio/SchemeLessonPanel.tsx`:

(a) Extend the `PreviewRow` interface (lines 33-39) to carry the extra fields:

```ts
interface PreviewRow {
  week?: number;
  lessonNumber?: string;
  specificCompetence?: string;
  mainActivity?: string;
  lessonObjective?: string;
  knowledgeAndSkills?: string;
  assessmentEvidence?: string;
  learningActivities?: string;
  misconceptions?: string;
  differentiationSupport?: string;
  resources?: string;
  reflection?: string;
}
```

(b) Map them when building `previewRows` (the `setPreviewRows(...)` map around lines 178-186). Extend each mapped object with:

```ts
            mainActivity: r.mainActivity,
            knowledgeAndSkills: r.knowledgeAndSkills,
            assessmentEvidence: r.assessmentEvidence,
            learningActivities: r.learningActivities,
            misconceptions: r.misconceptions,
            differentiationSupport: r.differentiationSupport,
            resources: r.resources,
            reflection: r.reflection,
```

(c) Add the columns to the review table `<thead>` (after `colObjective`, around line 320). This panel uses its own `scheme.col*` keys — add header cells reusing the keys added in C1 via the panel's translator if it shares the `lpManage` namespace; otherwise use plain text. To keep it simple and consistent with this panel's existing headers, add:

```tsx
                          <th>{t("scheme.colActivity")}</th>
                          <th>{t("scheme.colKnowledgeSkills")}</th>
                          <th>{t("scheme.colAssessment")}</th>
                          <th>{t("scheme.colLearningActivities")}</th>
                          <th>{t("scheme.colMisconceptions")}</th>
                          <th>{t("scheme.colDifferentiation")}</th>
                          <th>{t("scheme.colResources")}</th>
                          <th>{t("scheme.colReflection")}</th>
```

and the matching body cells (after the objective `<td>`, around line 329):

```tsx
                            <td>{r.mainActivity ?? "—"}</td>
                            <td>{r.knowledgeAndSkills ?? "—"}</td>
                            <td>{r.assessmentEvidence ?? "—"}</td>
                            <td>{r.learningActivities ?? "—"}</td>
                            <td>{r.misconceptions ?? "—"}</td>
                            <td>{r.differentiationSupport ?? "—"}</td>
                            <td>{r.resources ?? "—"}</td>
                            <td>{r.reflection ?? "—"}</td>
```

(d) Add the `scheme.col*` keys used above to **both** `messages/en/lpmanage.json` and `messages/sw/lpmanage.json` inside the existing `scheme` object (alongside `colWeek`/`colLesson`/`colCompetence`/`colObjective`). English values:

```json
"colActivity": "Main activity",
"colKnowledgeSkills": "Knowledge & skills",
"colAssessment": "Assessment / evidence",
"colLearningActivities": "Learning activities",
"colMisconceptions": "Misconceptions",
"colDifferentiation": "Differentiation / support",
"colResources": "Resources",
"colReflection": "Reflection"
```

Swahili values:

```json
"colActivity": "Shughuli kuu",
"colKnowledgeSkills": "Maarifa na stadi",
"colAssessment": "Tathmini / ushahidi",
"colLearningActivities": "Shughuli za kujifunza",
"colMisconceptions": "Dhana potofu",
"colDifferentiation": "Utofautishaji / msaada",
"colResources": "Rasilimali",
"colReflection": "Tafakari"
```

> First confirm the panel's translator namespace: `grep -n "useTranslations" src/app/[locale]/admin/ai-studio/SchemeLessonPanel.tsx`. If it is `useTranslations("lpStudio")` (or similar) rather than `lpManage`, add the `scheme.col*` keys to the corresponding `lpstudio` message files instead, matching the existing `scheme.colWeek` location. Use whichever namespace already defines `scheme.colWeek`.

- [ ] **Step 4: Validate JSON + typecheck**

Run: `node -e "['en','sw'].forEach(l=>require('./messages/'+l+'/lpmanage.json'));console.log('ok')"`
Then run: `npm run typecheck`
Expected: `ok`, then typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/admin/ai-studio/schemes/SchemesClient.tsx" "src/app/[locale]/admin/ai-studio/SchemeLessonPanel.tsx" messages/en/lpmanage.json messages/sw/lpmanage.json
git commit -m "feat(sow): show all 11 lesson columns in import preview tables

Both the admin upload preview and the Studio review table now render the
full 11 sow_lessons columns so a parsed scheme can be verified before
saving, not just week/lesson/competence/activity/objective.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task V: Final verification (whole-flow)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 2: Manual import verification (running app)**

Start the app (`npm run dev`) and, as an admin, go to **AI Studio → Schemes → upload**. Import each file from `SOW-examples/`:

- `Health_Environment_Grade2_Term1A_SOW (1).docx` — in the preview, confirm:
  - all 11 lesson columns are visible and populated;
  - the parsed header shows a **formative/summative assessment plan** (not the assessment items lumped under "Performance tasks"). This is the Task B1 fix observed end-to-end.
- `Grade 2 Arithmetic SOW -Revised 2-2.docx` — confirm all 11 columns render and weeks 1–7 are present.

Save one scheme, open a lesson in the edit form, confirm the 7 newly-wired fields are populated and round-trip on save.

- [ ] **Step 3: Manual generation verification**

Generate one lesson from a saved Health & Environment scheme lesson (30-min). Confirm generation succeeds and the teaching sequence is sized for a short period (sanity check that the pacing context took effect). No errors in the server console.

- [ ] **Step 4: Done**

No commit. If anything fails, return to the relevant task.

---

## Self-review notes

- **Spec coverage:** Component A → Tasks A1+A2; Component B → Task B1; Component C → Tasks C1+C2+C3; testing strategy → tests in B1/A1 + Task V manual pass. All spec sections mapped.
- **Type consistency:** `SchemeMeta` is defined once in `buildPrompt.ts` and imported by `assembleGeneration.ts` and `generate/route.ts`; the batch route builds a structurally-matching literal. Field names (`weeksCount`, `lessonsPerWeek`, `lessonDurationMins`, `totalLessons`) match the Drizzle columns (`number | null` / `string | null`) and the `SchemeMeta` optional fields.
- **Deferred:** teacher-facing display + PDF (out of scope per spec); duration is conveyed only via the prompt (no persisted field).
