/**
 * Unit tests for SOW parsing — the CSV path and the shared keyword→column
 * mapping are pure (no I/O), so they are exercised directly here. The docx path
 * differs only in how cells are extracted (mammoth → HTML table), which is
 * covered by `extractFirstTable`-style fixtures fed through the same mapper.
 */
import { describe, it, expect } from "vitest";

import { parseSowCsv, parseSowHtml, type ParsedSowRow } from "./parse";

/** Assert exactly `n` rows and return the first, narrowing it for the asserts. */
function firstRow(rows: ParsedSowRow[], n = 1): ParsedSowRow {
  expect(rows).toHaveLength(n);
  const row = rows[0];
  if (!row) throw new Error("expected at least one parsed row");
  return row;
}

describe("parseSowCsv", () => {
  it("maps canonical headers to the 11 SOW columns", () => {
    const csv = [
      "Week,Lesson,Specific Competence,Main Activity,Lesson Objective,Knowledge and Skills,Assessment / Evidence,Learning Activities,Misconceptions,Differentiation & Support,Resources,Reflection",
      "3,2,4.1 Recognise numbers,Count to ten,Learner can count,Counting,Oral quiz,I do/We do/You do,Confusing 6 and 9,Extra examples,Counters,Went well",
    ].join("\n");

    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.week).toBe(3);
    expect(row.lessonNumber).toBe("2");
    expect(row.specificCompetence).toBe("4.1 Recognise numbers");
    expect(row.mainActivity).toBe("Count to ten");
    expect(row.lessonObjective).toBe("Learner can count");
    expect(row.knowledgeAndSkills).toBe("Counting");
    expect(row.assessmentEvidence).toBe("Oral quiz");
    expect(row.learningActivities).toBe("I do/We do/You do");
    expect(row.misconceptions).toBe("Confusing 6 and 9");
    expect(row.differentiationSupport).toBe("Extra examples");
    expect(row.resources).toBe("Counters");
    expect(row.reflection).toBe("Went well");
  });

  it("is tolerant of header drift and casing", () => {
    const csv = [
      "WK,Lesson No.,SPECIFIC COMPETENCE,Sample Lesson Activities,Teaching & Learning Resources",
      "1,1,Comp A,Do the thing,Textbook p.4",
    ].join("\n");

    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.week).toBe(1);
    expect(row.lessonNumber).toBe("1");
    expect(row.specificCompetence).toBe("Comp A");
    // "Sample Lesson Activities" → learningActivities (the revised-template
    // column), NOT mainActivity.
    expect(row.learningActivities).toBe("Do the thing");
    expect(row.mainActivity).toBeUndefined();
    expect(row.resources).toBe("Textbook p.4");
  });

  it("maps a 'Remarks' column to reflection", () => {
    const csv = ["Lesson,Remarks", "1,See note"].join("\n");
    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.reflection).toBe("See note");
  });

  it("does not let the generic activity rule steal learning activities", () => {
    const csv = [
      "Lesson,Learning Activities,Main Activity",
      "1,LA text,MA text",
    ].join("\n");

    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.learningActivities).toBe("LA text");
    expect(row.mainActivity).toBe("MA text");
  });

  it("preserves unmapped cells in rawCells and skips empty rows", () => {
    const csv = [
      "Lesson,Specific Competence,Custom Notes",
      "1,Comp,Some note",
      ",,",
    ].join("\n");

    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.rawCells["Custom Notes"]).toBe("Some note");
    expect(row.rawCells["Specific Competence"]).toBe("Comp");
  });

  it("parses a week label like 'Week 5' to a number", () => {
    const csv = ["Week,Specific Competence", "Week 5,Comp"].join("\n");
    const row = firstRow(parseSowCsv(csv).rows);
    expect(row.week).toBe(5);
  });

  it("returns no rows for an empty body", () => {
    const csv = "Week,Specific Competence\n";
    expect(parseSowCsv(csv).rows).toHaveLength(0);
  });
});

// ── parseSowHtml (revised multi-table docx) ────────────────────────────────

/** Build an HTML table from a 2-D array of cell strings. */
function htmlTable(rows: string[][]): string {
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${body}</table>`;
}

const META_TABLE = htmlTable([
  ["Grade", "2", "Number of Weeks", "10", "Main Competence", "4.0 Arithmetic"],
  ["Subject", "Arithmetic", "Lessons/Periods per Week", "8", "Term", "1A"],
  ["Specific competences", "4.1 Use mathematical operations", "Year", "2026", "Duration per Lesson/Period", "40min"],
]);

const DESIRED_TABLE = htmlTable([
  ["DESIRED RESULTS"],
  ["Transfer Goal", "Enduring Understandings", "Essential Questions", "Knowledge", "Skills"],
  [
    "Learners use place-value reasoning.",
    "U1- Position tells worth. U2- One quantity, many forms. U3- Compare by place value.",
    "EQ1- Why write numbers? EQ2- Can a symbol mean different things?",
    "K1- A three-digit number has hundreds, tens, ones. K2- Ones are worth 1s.",
    "S1- Illustrate a number. S7a- Compare two numbers. S7b- Explain the comparison.",
  ],
]);

const EVIDENCE_TABLE = htmlTable([
  ["ACCEPTABLE EVIDENCE"],
  ["Task", "Details/Content", "Success Criteria", "When"],
  ["The Market Stall", "Help Mama Njeri order her sales records.", "All amounts in figures.", "Week 5"],
]);

const ASSESSMENT_TABLE = htmlTable([
  ["Formative Assessments (collected throughout)", "Summative Assessments (end of unit)"],
  ["Type", "What learner does", "Assesses", "When", "Type", "Details", "Assesses", "When"],
  ["EXIT TICKETS", "A five-question ticket", "the day's content", "every lesson", "BASELINE ASSESSMENT", "A full written paper", "prior knowledge", "Week 1"],
  ["MONTHLY ASSESSMENTS", "the School Compound Survey performance task is launched", "weeks 2-6", "Week 7", "MID-TERM EXAM", "A 20-mark paper", "all objectives", "Week 11"],
]);

describe("parseSowHtml — metadata", () => {
  it("parses the metadata grid into scheme fields", () => {
    const { scheme } = parseSowHtml(META_TABLE);
    expect(scheme.grade).toBe("Grade 2");
    expect(scheme.subject).toBe("Arithmetic");
    expect(scheme.term).toBe("1A");
    expect(scheme.year).toBe("2026");
    expect(scheme.mainCompetence).toBe("4.0 Arithmetic");
    expect(scheme.weeksCount).toBe(10);
    expect(scheme.lessonsPerWeek).toBe(8);
    expect(scheme.lessonDurationMins).toBe(40);
  });

  it("strips a leading 'Term ' from the term value", () => {
    const html = htmlTable([["Grade", "2", "Term", "Term 1A", "Subject", "Math"]]);
    expect(parseSowHtml(html).scheme.term).toBe("1A");
  });
});

describe("parseSowHtml — desired results", () => {
  it("splits the UbD columns into labelled items", () => {
    const { headerContext: ctx } = parseSowHtml(META_TABLE + DESIRED_TABLE);
    expect(ctx.transferGoal).toContain("place-value");
    expect(ctx.enduringUnderstandings).toHaveLength(3);
    expect(ctx.enduringUnderstandings[0]).toMatch(/^U1-/);
    expect(ctx.essentialQuestions).toHaveLength(2);
    expect(ctx.knowledge).toHaveLength(2);
    // S7a / S7b sub-skills split correctly.
    expect(ctx.skills).toHaveLength(3);
    expect(ctx.skills[2]).toMatch(/^S7b-/);
    expect(ctx.specificCompetences).toContain("4.1");
  });

  it("captures performance tasks from the evidence table", () => {
    const { headerContext: ctx } = parseSowHtml(META_TABLE + EVIDENCE_TABLE);
    expect(ctx.performanceTasks.length).toBeGreaterThan(0);
    expect(ctx.performanceTasks[0]).toContain("The Market Stall");
  });
});

describe("parseSowHtml — assessment plan vs evidence", () => {
  it("routes a formative/summative table to the assessment plan, not performance tasks", () => {
    const { headerContext: ctx } = parseSowHtml(
      META_TABLE + EVIDENCE_TABLE + ASSESSMENT_TABLE,
    );
    expect(ctx.performanceTasks.some((t) => /Market Stall/.test(t))).toBe(true);
    expect(ctx.performanceTasks.some((t) => /EXIT TICKETS/.test(t))).toBe(false);
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

describe("parseSowHtml — week tables", () => {
  const weekTable = (title: string, lessons: string[][]) =>
    htmlTable([
      [title],
      ["Lesson", "Specific Competence", "Main Activity", "Lesson Objective", "Sample Lesson activities", "Teaching and Learning Resources", "Remarks"],
      ...lessons,
    ]);

  it("extracts lessons and carries the week number from the title row", () => {
    const html =
      META_TABLE +
      weekTable("Week 2: Identifying Numbers", [
        ["1", "4.1 Numbers", "Count to 200", "Learner counts", "I do / We do", "Counters", "Watch reversals"],
      ]);
    const { rows } = parseSowHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.week).toBe(2);
    expect(rows[0]!.lessonNumber).toBe("1");
    expect(rows[0]!.specificCompetence).toBe("4.1 Numbers");
    expect(rows[0]!.mainActivity).toBe("Count to 200");
    // The collision fix: "Sample Lesson activities" → learningActivities.
    expect(rows[0]!.learningActivities).toBe("I do / We do");
    expect(rows[0]!.resources).toBe("Counters");
    expect(rows[0]!.reflection).toBe("Watch reversals");
  });

  it("drops empty week templates and keeps the richest duplicate", () => {
    const rich = weekTable("Week 1: Foundations", [
      ["1", "4.1 Numbers", "Count", "Learner counts", "I do", "Counters", "ok"],
    ]);
    const sparse = weekTable("Week 1: Foundations", [["1", "", "", "", "", "", ""]]);
    const emptyTemplate = weekTable("Week:", [["", "", "", "", "", "", ""]]);

    const { rows, stats } = parseSowHtml(META_TABLE + sparse + rich + emptyTemplate);
    // One week-1 row kept (the rich variant); empties dropped.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.specificCompetence).toBe("4.1 Numbers");
    expect(stats.weekTablesKept).toBe(1);
    expect(stats.weekTablesDropped).toBeGreaterThanOrEqual(2);
  });

  it("orders rows by week number", () => {
    const html =
      META_TABLE +
      weekTable("Week 3: C", [["1", "c", "", "", "", "", ""]]) +
      weekTable("Week 1: A", [["1", "a", "", "", "", "", ""]]);
    const { rows } = parseSowHtml(html);
    expect(rows.map((r) => r.week)).toEqual([1, 3]);
  });

  it("keeps a lesson whose prose mentions 'objective' or 'activity'", () => {
    // Regression: these rows were mistaken for repeated headers and dropped.
    // Both cells below are lifted from the real Grade 2 Health & Environment
    // scheme, which silently lost two lessons this way.
    const html =
      META_TABLE +
      weekTable("Week 6: Can the group change?", [
        [
          "L10 Wk6 · P2",
          "7.1 Observe objects",
          "Benefits of wild animals",
          "Explain a benefit of a wild animal",
          "I do / We do",
          "Pupil's Book page 9, with the habitat activity on page 3.",
          "Note groups ready to lead",
        ],
        [
          "Midterm P1",
          "7.1 Observe objects",
          "Midterm written paper",
          "Show mastery of every 7.1 objective across the full range of demand",
          "Administer the paper",
          "Printed midterm paper",
          "Use the results to plan Term 1B",
        ],
      ]);
    const { rows } = parseSowHtml(html);
    expect(rows.map((r) => r.lessonNumber)).toEqual(["L10 Wk6 · P2", "Midterm P1"]);
  });

  it("still drops a header row repeated inside the body", () => {
    const html =
      META_TABLE +
      htmlTable([
        ["Week 4: Repeats"],
        ["Lesson", "Specific Competence", "Main Activity", "Lesson Objective", "Sample Lesson activities", "Teaching and Learning Resources", "Remarks"],
        ["1", "4.1 Numbers", "Count", "Learner counts", "I do", "Counters", "ok"],
        ["Lesson", "Specific Competence", "Main Activity", "Lesson Objective", "Sample Lesson activities", "Teaching and Learning Resources", "Remarks"],
        ["2", "4.1 Numbers", "Order", "Learner orders", "We do", "Cards", "ok"],
      ]);
    const { rows } = parseSowHtml(html);
    expect(rows.map((r) => r.lessonNumber)).toEqual(["1", "2"]);
  });
});
