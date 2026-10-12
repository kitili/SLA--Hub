import { describe, expect, it } from "vitest";

import { buildCoverageModel, type CoveragePayload } from "./model";

const payload: CoveragePayload = {
  generatedAt: "2026-10-12T00:00:00.000Z",
  scopeGrades: ["KG1", "Grade 1"],
  tieNotTracked: ["KG1"],
  terms: ["T1A", "T1B"],
  termLabels: { T1A: "Term 1A", T1B: "Term 1B" },
  curriculum: {
    grades: {
      "Grade 1": {
        subjects: ["Mathematics"],
        blocks: {
          Mathematics: {
            T1A: { sow: "https://docs.google.com/document/d/sow", lessons: 2, linked: 2, placeholders: 1, unlinked: 0 },
            T1B: { sow: "", lessons: 1, linked: 0, placeholders: 0, unlinked: 1 },
          },
        },
      },
    },
    lessons: [
      { g: "Grade 1", s: "Mathematics", t: "T1A", n: "1", title: "Place value", url: "https://docs.google.com/document/d/lp", k: "doc" },
      { g: "Grade 1", s: "Mathematics", t: "T1A", n: "2", title: "Addition", url: "https://docs.google.com/document/d/lp2", k: "doc" },
      { g: "Grade 1", s: "Mathematics", t: "T1B", n: "1", title: "Subtraction", url: "", k: "none" },
    ],
  },
  tie: [
    { grade: "Grade 1", subject: "Mathematics", textbooks: ["https://docs.google.com/document/d/tb"], design: "https://docs.google.com/document/d/design" },
  ],
  assessments: {
    copies: [
      { grade: "Grade 1", type: "Termly", subject: "Mathematics", term: "Term 1A", code: "T1A", version: "A", paper: "https://docs.google.com/document/d/p", scheme: "https://docs.google.com/document/d/s", notes: "", tree: "a", folder: "folder", path: "path", setNo: 1, setsHere: 1 },
      { grade: "Grade 1", type: "SFNA", subject: "Mathematics", term: "Term 1A", code: "T1A", version: "A", paper: "https://docs.google.com/document/d/p2", scheme: "", notes: "", tree: "a", folder: "folder", path: "path", setNo: 1, setsHere: 1 },
    ],
    summary: {},
  },
};

describe("coverage model", () => {
  const model = buildCoverageModel(payload);

  it("keeps an unfinished grade outstanding and leaves KG1 TIE untracked", () => {
    const lessons = model.matrix.find((line) => line.key === "lp");
    const tie = model.matrix.find((line) => line.key === "tie");
    expect(lessons?.cells.find((item) => item.grade === "Grade 1")?.state).toBe("out");
    expect(tie?.cells.find((item) => item.grade === "KG1")?.state).toBe("na");
    expect(tie?.cells.find((item) => item.grade === "Grade 1")?.state).toBe("done");
    expect(model.tot.placeholders).toBe(1);
    expect(model.tot.linked).toBe(2);
    expect(model.aTot).toMatchObject({ total: 2, complete: 1, sfna: 1, termly: 1, docs: 3 });
  });
});
