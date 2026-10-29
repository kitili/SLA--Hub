/**
 * One-off: write the six authored Grade 2 plans as an import manifest.
 * Run with `npm run db:run -- ./src/lib/db/scripts/exportSampleManifest.ts`.
 */
import { writeFileSync } from "node:fs";

import { applyKnownIdentifier } from "@/lib/ai/lessonPlan/identifier";
import { renderLessonMarkdown } from "@/lib/ai/lessonPlan/renderMarkdown";
import { buildFilename } from "@/lib/naming/format";

import { SAMPLE_PLANS } from "./sampleLessonPlans";

const out = process.argv[2];
if (!out) {
  throw new Error("Pass an output path.");
}

const manifest = SAMPLE_PLANS.map((plan) => {
  const filename = buildFilename({
    grade: plan.grade,
    subject: plan.subject,
    term: plan.term,
    week: plan.week,
    lesson: plan.lesson,
  });
  const normalized = applyKnownIdentifier(plan.structured, {
    grade: plan.grade,
    subject: plan.subject,
    term: plan.term,
    week: plan.week,
    lesson: plan.lesson,
  });
  return {
    filename,
    title: normalized.identifier.title,
    topic: normalized.identifier.specific_competence,
    durationMinutes: plan.durationMinutes,
    objectives: normalized.success_criteria,
    contentMarkdown: renderLessonMarkdown(normalized),
    contentJson: normalized,
  };
});

writeFileSync(out, JSON.stringify(manifest));
console.log(manifest.map((row) => row.filename).join("\n"));
