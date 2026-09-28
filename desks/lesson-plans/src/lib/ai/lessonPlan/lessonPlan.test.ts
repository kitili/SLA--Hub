/**
 * Unit tests for the AI Studio v2 domain layer:
 *   - validate (validateLessonPlan)
 *   - buildPrompt (buildPrompt, applyTemplate)
 *   - renderMarkdown (renderLessonMarkdown)
 *   - identifier (applyKnownIdentifier)
 *   - assembleGeneration (buildSchemeLesson)
 *
 * parsePartial has its own file (parsePartial.test.ts).
 *
 * Uses the shared minimal valid StructuredLessonPlan fixture
 * (test/fixtures/structuredPlan.ts, blueprint exemplar — Grade 1 Arithmetic,
 * "many and few").
 */
import { describe, expect, it } from "vitest";

import { validateLessonPlan } from "./validate";
import { buildPrompt, applyTemplate, type BuildPromptInput } from "./buildPrompt";
import { renderLessonMarkdown } from "./renderMarkdown";
import { applyKnownIdentifier } from "./identifier";
import { buildSchemeLesson } from "./assembleGeneration";
import type { StructuredLessonPlan } from "./structuredSchema";
import { DEFAULT_PROMPT_PART_MAP } from "./promptDefaults";
import { VALID_PLAN } from "../../../../test/fixtures/structuredPlan";

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

describe("validateLessonPlan", () => {
  it("returns [] for a fully valid plan", () => {
    expect(validateLessonPlan(VALID_PLAN)).toEqual([]);
  });

  it("(a) surfaces Zod schema errors for a structurally invalid plan", () => {
    // @ts-expect-error intentionally invalid
    const bad: StructuredLessonPlan = { ...VALID_PLAN, success_criteria: "not-an-array" };
    const issues = validateLessonPlan(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/^schema:/);
  });

  it("(b) flags child-voice 'I can' in success_criteria", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      success_criteria: ["I can count to ten.", "Students can compare groups."],
    };
    const issues = validateLessonPlan(bad);
    expect(issues).toContain(
      "voice: a success_criteria entry is in the child's 'I can' voice " +
        "(v2 requires the teacher's 'Students can ...').",
    );
  });

  it("(b) is case-insensitive for the voice check", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      success_criteria: ["  I CAN   name the groups.", "Students can compare groups."],
    };
    expect(validateLessonPlan(bad).some((e) => e.startsWith("voice:"))).toBe(true);
  });

  it("(c) flags lane collapse when success_criteria duplicates a Knows entry", () => {
    // Make success_criteria match a knows entry exactly (after normalisation)
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      success_criteria: [
        "A group with more objects can be described as 'many'.", // same as knows[0]
        "Students can compare groups.",
      ],
    };
    const issues = validateLessonPlan(bad);
    expect(issues).toContain(
      "MECE: a success_criteria entry is identical to a Knows/Shows (lane collapse).",
    );
  });

  it("(c) flags lane collapse when success_criteria duplicates a Shows entry", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      success_criteria: [
        "Observe two groups and orally state which has 'many' and which has 'few'.", // same as shows[0]
        "Students can compare groups.",
      ],
    };
    expect(
      validateLessonPlan(bad).some((e) => e.startsWith("MECE: a success_criteria")),
    ).toBe(true);
  });

  it("(d) flags assessment_method that restates a success criterion", () => {
    // Embed a full success_criteria string inside assessment_method
    const criterion = VALID_PLAN.success_criteria[0]!;
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      assessment_method: `Observe whether ${criterion}`,
    };
    const issues = validateLessonPlan(bad);
    expect(issues).toContain(
      "MECE: assessment_method restates a success criterion (should name only the method).",
    );
  });

  it("(e) flags empty checkpoint in introduction_hook", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      teaching_sequence: {
        ...VALID_PLAN.teaching_sequence,
        introduction_hook: {
          ...VALID_PLAN.teaching_sequence.introduction_hook,
          checkpoint: "   ",
        },
      },
    };
    const issues = validateLessonPlan(bad);
    expect(issues).toContain(
      "checkpoint empty in introduction_hook: the assessment questions must be " +
        "distributed one-per-stage, not left blank.",
    );
  });

  it("(e) flags empty checkpoint in each of the four stages", () => {
    // Use whitespace-only checkpoints — they pass Zod's min(1) but fail .trim() in the guard.
    for (const key of ["introduction_hook", "i_do", "we_do", "you_do"] as const) {
      const bad: StructuredLessonPlan = {
        ...VALID_PLAN,
        teaching_sequence: {
          ...VALID_PLAN.teaching_sequence,
          [key]: { ...VALID_PLAN.teaching_sequence[key], checkpoint: "   " },
        },
      };
      const issues = validateLessonPlan(bad);
      expect(issues.some((e) => e.includes(`checkpoint empty in ${key}`))).toBe(true);
    }
  });

  it("(f) flags teacher_reflection with wrong count (2 questions)", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      teacher_reflection: ["Question one?", "Question two?"],
    };
    const issues = validateLessonPlan(bad);
    expect(issues).toContain(
      "teacher_reflection must have exactly 3 questions, got 2.",
    );
  });

  it("(f) flags teacher_reflection with wrong count (4 questions)", () => {
    const bad: StructuredLessonPlan = {
      ...VALID_PLAN,
      teacher_reflection: ["Q1?", "Q2?", "Q3?", "Q4?"],
    };
    const issues = validateLessonPlan(bad);
    expect(issues.some((e) => e.includes("got 4"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildPrompt / applyTemplate
// ---------------------------------------------------------------------------

describe("applyTemplate", () => {
  it("replaces all {{key}} placeholders", () => {
    expect(applyTemplate("Hello {{name}}, you are {{age}} years old.", { name: "Alice", age: 30 })).toBe(
      "Hello Alice, you are 30 years old.",
    );
  });

  it("leaves unknown placeholders unchanged", () => {
    expect(applyTemplate("Hello {{unknown}}", { name: "Alice" })).toBe("Hello {{unknown}}");
  });
});

describe("buildPrompt", () => {
  const baseInput: BuildPromptInput = {
    parts: {},
    schemeHeader: "SCHEME HEADER TEXT",
    schemeLesson: "SCHEME LESSON TEXT",
    grade: "3",
    subject: "English",
    sourceIdx: 7,
  };

  it("sets system to the default system message when parts.system is empty", () => {
    const { system } = buildPrompt(baseInput);
    expect(system).toBe(DEFAULT_PROMPT_PART_MAP.system);
  });

  it("uses a custom system message when provided", () => {
    const { system } = buildPrompt({ ...baseInput, parts: { system: "Custom system" } });
    expect(system).toBe("Custom system");
  });

  it("includes the rules section in the prompt", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain(DEFAULT_PROMPT_PART_MAP.rules.slice(0, 40));
  });

  it("includes the blueprint section with its header", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain(
      "=== BLUEPRINT — the worked exemplar to MATCH in shape & depth (copy the structure, NEVER the content) ===",
    );
  });

  it("includes the schema_note section", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain(DEFAULT_PROMPT_PART_MAP.schema_note.slice(0, 40));
  });

  it("embeds the schemeHeader with its section header", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain(
      "=== SCHEME HEADER CONTEXT (shared what & why for the whole scheme) ===\nSCHEME HEADER TEXT",
    );
  });

  it("embeds the schemeLesson with its section header", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain(
      "=== SCHEME LESSON to build into a full lesson plan ===\nSCHEME LESSON TEXT",
    );
  });

  it("fills {{grade}}, {{subject}}, {{sourceIdx}} placeholders in the task", () => {
    const { prompt } = buildPrompt(baseInput);
    expect(prompt).toContain("Grade 3");
    expect(prompt).toContain("English");
    expect(prompt).toContain("meta.source_lesson_idx=7");
  });

  it("appends repair suffix when repairIssues are provided", () => {
    const { prompt } = buildPrompt({
      ...baseInput,
      repairIssues: ["voice: a success_criteria is in child voice.", "MECE: lane collapse."],
    });
    expect(prompt).toContain("=== YOUR PREVIOUS OUTPUT FAILED VALIDATION ===");
    expect(prompt).toContain("- voice: a success_criteria is in child voice.");
    expect(prompt).toContain("- MECE: lane collapse.");
    expect(prompt).toContain("Fix these issues and output the corrected object only");
  });

  it("does NOT append repair suffix when repairIssues is empty", () => {
    const { prompt } = buildPrompt({ ...baseInput, repairIssues: [] });
    expect(prompt).not.toContain("=== YOUR PREVIOUS OUTPUT FAILED VALIDATION ===");
  });

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

  it("falls back to defaults for all parts when parts is empty", () => {
    const { system, prompt } = buildPrompt(baseInput);
    expect(system).toBe(DEFAULT_PROMPT_PART_MAP.system);
    expect(prompt).toContain(DEFAULT_PROMPT_PART_MAP.rules.slice(0, 30));
  });

  it("overrides individual parts when provided", () => {
    const { prompt } = buildPrompt({
      ...baseInput,
      parts: { rules: "CUSTOM RULES CONTENT" },
    });
    expect(prompt).toContain("CUSTOM RULES CONTENT");
    // Default blueprint should still be present
    expect(prompt).toContain(DEFAULT_PROMPT_PART_MAP.blueprint.slice(0, 30));
  });
});

// ---------------------------------------------------------------------------
// renderLessonMarkdown
// ---------------------------------------------------------------------------

describe("renderLessonMarkdown", () => {
  const md = renderLessonMarkdown(VALID_PLAN);

  it("starts with the lesson title as an h1", () => {
    expect(md).toMatch(/^# Identifying groups with many and few objects/);
  });

  it("includes the meta line with grade, subject, week, lesson number, and competences", () => {
    expect(md).toContain("1 · Arithmetic · Week 1 · Lesson 1");
    expect(md).toContain("Main competence 4. Arithmetic");
    expect(md).toContain("Specific competence 4.1 Recognise the concept of numbers");
  });

  it("has a ## Success criteria section with bullet items", () => {
    expect(md).toContain("## Success criteria");
    expect(md).toContain("- Students can look at two groups");
  });

  it("has ## Knows and ## Shows sections", () => {
    expect(md).toContain("## Knows");
    expect(md).toContain("## Shows");
    expect(md).toContain("- A group with more objects can be described as 'many'.");
  });

  it("has ## Misconceptions to watch for with bold lead and italic description", () => {
    expect(md).toContain("## Misconceptions to watch for");
    expect(md).toContain("**'Many' and 'few' are relative.**");
    expect(md).toContain("*Thinking 'many' always means a fixed large number");
  });

  it("has ## Materials and preparation section", () => {
    expect(md).toContain("## Materials and preparation");
    expect(md).toContain("- Two clear groups of objects");
  });

  it("has ## Teaching sequence with ### stage headings including depth", () => {
    expect(md).toContain("## Teaching sequence");
    expect(md).toContain("### Introduction / Hook (Surface)");
    expect(md).toContain("### I Do (Surface)");
    expect(md).toContain("### We Do (Deep)");
    expect(md).toContain("### You Do (Deep)");
  });

  it("includes sentence frame and checkpoint for each stage", () => {
    expect(md).toContain("*Sentence frame:*");
    expect(md).toContain("*Checkpoint (assessment):*");
    expect(md).toContain("There are _____ soap for _____ children");
    expect(md).toContain("Are there MANY or FEW bars of soap");
  });

  it("has ## Differentiation section with remedial, support, challenge, digital", () => {
    expect(md).toContain("## Differentiation (suggestions)");
    expect(md).toContain("**Remedial:**");
    expect(md).toContain("**Support:**");
    expect(md).toContain("**Challenge:**");
    expect(md).toContain("**Digital resource idea (if available):**");
    expect(md).toContain("- A short 'many vs few' video (if available).");
  });

  it("has ## Conclusion and exit ticket section", () => {
    expect(md).toContain("## Conclusion and exit ticket");
    expect(md).toContain("A group is many or few depending on what we compare it to.");
    expect(md).toContain("**Exit ticket:**");
  });

  it("includes assessment method", () => {
    expect(md).toContain("**Assessment method:** Observe pair work during You Do");
  });

  it("has ## Watch-for notes section", () => {
    expect(md).toContain("## Watch-for notes");
    expect(md).toContain("- Listen for learners who consistently mix up");
  });

  it("has ## Teacher reflection section", () => {
    expect(md).toContain("## Teacher reflection");
    expect(md).toContain("- Did the introduction with physical objects hook");
    expect(md).toContain("- Was the transition from everyday language");
    expect(md).toContain("- How accurate were the learners' pairs");
  });
});

// ---------------------------------------------------------------------------
// identifier / applyKnownIdentifier
// ---------------------------------------------------------------------------

describe("applyKnownIdentifier", () => {
  const ctx = { grade: "G1", subject: "Arithmetic", term: "1a", week: 2, lesson: 3 };

  it("overwrites the model-echoed coordinates with the known context", () => {
    // The fixture deliberately mislabels term/week the way models do.
    const echoed: StructuredLessonPlan = {
      ...VALID_PLAN,
      identifier: { ...VALID_PLAN.identifier, term: "2A", week: "Week 9" },
    };
    const fixed = applyKnownIdentifier(echoed, ctx);
    expect(fixed.identifier).toEqual({
      ...VALID_PLAN.identifier,
      grade: "G1",
      subject: "Arithmetic",
      term: "1A", // upper-cased for display
      week: "2",
      lesson_number: "3",
    });
    // Non-identifier content is untouched, and the input is not mutated.
    expect(fixed.success_criteria).toBe(echoed.success_criteria);
    expect(echoed.identifier.term).toBe("2A");
  });

  it("preserves title and competences (only coordinates are overwritten)", () => {
    const fixed = applyKnownIdentifier(VALID_PLAN, ctx);
    expect(fixed.identifier.title).toBe(VALID_PLAN.identifier.title);
    expect(fixed.identifier.main_competence).toBe(VALID_PLAN.identifier.main_competence);
    expect(fixed.identifier.specific_competence).toBe(
      VALID_PLAN.identifier.specific_competence,
    );
  });

  it("returns a partial draft unchanged while identifier has not streamed in", () => {
    const draft: Partial<StructuredLessonPlan> = { success_criteria: ["Students can x."] };
    expect(applyKnownIdentifier(draft, ctx)).toBe(draft);
  });
});

// ---------------------------------------------------------------------------
// assembleGeneration / buildSchemeLesson
// ---------------------------------------------------------------------------

describe("buildSchemeLesson", () => {
  it("returns an empty string for a missing scheme", () => {
    expect(buildSchemeLesson(undefined)).toBe("");
  });

  it("builds the '## Lesson N · Week W' header from both coordinates", () => {
    const blob = buildSchemeLesson({ lessonNumber: "3", week: 2 });
    expect(blob.split("\n")).toEqual(["## Lesson 3 · Week 2", ""]);
  });

  it("builds a partial header when only one coordinate is present", () => {
    expect(buildSchemeLesson({ lessonNumber: "3" })).toContain("## Lesson 3");
    expect(buildSchemeLesson({ lessonNumber: "3" })).not.toContain("Week");
    expect(buildSchemeLesson({ week: 2 })).toContain("## Week 2");
  });

  it("omits the header entirely when neither coordinate is present", () => {
    const blob = buildSchemeLesson({ specificCompetence: "Compare groups" });
    expect(blob).toBe("**Specific competence:** Compare groups");
  });

  it("keeps only non-empty columns, trimmed, in the canonical label order", () => {
    const blob = buildSchemeLesson({
      lessonNumber: "1",
      week: 1,
      specificCompetence: "  Compare groups  ",
      mainActivity: "",
      lessonObjective: "   ",
      resources: "Bottle tops",
      reflection: "Did it land?",
    });
    expect(blob.split("\n")).toEqual([
      "## Lesson 1 · Week 1",
      "",
      "**Specific competence:** Compare groups",
      "**Resources:** Bottle tops",
      "**Reflection:** Did it land?",
    ]);
  });
});
