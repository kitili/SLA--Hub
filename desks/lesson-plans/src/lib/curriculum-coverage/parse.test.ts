import { describe, expect, it } from "vitest";
import { canonGrade, canonSubject, canonTerm } from "./canon";
import { parseAssessmentCopies, parseCurriculumGrid, parseSummary, parseTieGrid, safeDocumentUrl } from "./parse";

describe("curriculum name mixes", () => {
  it("folds grade, subject, and term spellings", () => {
    expect(canonGrade("GRADE 1")).toBe("Grade 1");
    expect(canonGrade("g 3")).toBe("Grade 3");
    expect(canonGrade("KG 2")).toBe("KG2");
    expect(canonSubject("Maths")).toBe("Mathematics");
    expect(canonSubject("science & technology")).toBe("Science and Technology");
    expect(canonTerm("term 1a")).toBe("T1A");
    expect(canonTerm("1B")).toBe("T1B");
  });

  it("merges subject spellings and ignores folder links and formula mirrors", () => {
    const vals = [
      ["Maths T1A", "", "", "Mathematics Term 1A", "", ""],
      ["SOW", "No", "Lesson", "SOW", "No", "Lesson"],
      ["", "1", "Place value", "", "2", "Addition"],
      ["", "", "Exam week", "", "", "=C3"],
    ];
    const forms = [
      ["", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["", "", "", "", "", "=C3"],
    ];
    const links = [
      ["", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["https://docs.google.com/document/d/sow", "", "https://docs.google.com/document/d/lp1", "", "", "https://docs.google.com/document/d/lp2"],
      ["", "", "https://drive.google.com/drive/folders/exam", "", "", ""],
    ];
    const parsed = parseCurriculumGrid("GRADE 1 SOW & LESSON PLANS", vals, forms, links);
    expect(parsed?.grade).toBe("Grade 1");
    expect(parsed?.subjects).toEqual(["Mathematics"]);
    const block = parsed?.blocks.Mathematics?.T1A;
    expect(block?.sow).toContain("/document/d/sow");
    expect(block?.linked).toBe(2);
    expect(block?.placeholders).toBe(1);
    expect(block?.lessons).toBe(2);
    expect(parsed?.lessons.map((lesson) => lesson.title)).toEqual(["Place value", "Addition"]);
  });

  it("counts every assessment row and numbers mixed term codes as one window", () => {
    const header = ["Status", "Grade", "Type", "Subject", "Term", "Term Code", "Version", "Paper", "Marking Scheme", "Invigilator Notes", "Source Tree", "Source Folder", "Full Path"];
    const row = (status: string, grade: string, code: string, version: string, tree: string) =>
      [status, grade, "Termly", "Maths", "Term 1A", code, version, "paper", "scheme", "", tree, "folder", "path"];
    const copies = parseAssessmentCopies(
      [header, row("Duplicate", "GRADE 5", "1A", "A", "folder-b"), row("Ok", "Grade 5", "T1A", "B", "folder-a")],
      [[], [], []],
      [
        [],
        ["", "", "", "", "", "", "", "https://docs.google.com/document/d/p1", "https://docs.google.com/document/d/s1", "", "", "", ""],
        ["", "", "", "", "", "", "", "https://docs.google.com/document/d/p2", "https://docs.google.com/document/d/s2", "", "", "", ""],
      ],
    );
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map((copy) => copy.grade))).toEqual(new Set(["Grade 5"]));
    expect(new Set(copies.map((copy) => copy.subject))).toEqual(new Set(["Mathematics"]));
    expect(new Set(copies.map((copy) => copy.code))).toEqual(new Set(["T1A"]));
    expect(copies.map((copy) => copy.setNo).sort()).toEqual([1, 2]);
    expect(copies.every((copy) => copy.setsHere === 2)).toBe(true);
  });

  it("drops the sheet summary counts that treat real papers as duplicates", () => {
    expect(parseSummary([
      ["Unique assessments", "564"],
      ["Indexed on", "18 Sep 2026"],
    ])).toEqual({ "Indexed on": "18 Sep 2026" });
  });

  it("canonicalises TIE grades and subjects", () => {
    const rows = parseTieGrid(
      [["Grade", "Subject"], ["grade 2", "Kiswahili Language"]],
      [[], ["", "", "https://book", "", "https://design"]],
    );
    expect(rows).toEqual([{ grade: "Grade 2", subject: "Kiswahili", textbooks: ["https://book"], design: "https://design" }]);
  });

  it("refuses script and plain-text links from a sheet cell", () => {
    expect(safeDocumentUrl("https://docs.google.com/document/d/abc")).toBe("https://docs.google.com/document/d/abc");
    expect(safeDocumentUrl("javascript:alert(1)")).toBeNull();
    expect(safeDocumentUrl("not a link")).toBeNull();
  });
});
