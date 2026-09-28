/**
 * Unit tests for the lesson-plan filename naming convention — pure, no I/O.
 */
import { describe, it, expect } from "vitest";

import { TERM_ORDINAL, type Term } from "./constants";
import { parse } from "./parse";
import { buildFilename } from "./format";

describe("parse", () => {
  it("parses the canonical example G7_Math_T1a_W1_L1", () => {
    const result = parse("G7_Math_T1a_W1_L1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      grade: "G7",
      gradeNum: 7,
      subject: "Math",
      term: "1a",
      termOrdinal: 1,
      week: 1,
      lesson: 1,
      slug: "g7-math-t1a-w1-l1",
    });
  });

  it("parses a two-digit grade, multi-digit week/lesson, and other subjects", () => {
    const cases = [
      {
        input: "G12_English_T2b_W14_L3",
        expected: {
          grade: "G12",
          gradeNum: 12,
          subject: "English",
          term: "2b",
          termOrdinal: 4,
          week: 14,
          lesson: 3,
          slug: "g12-english-t2b-w14-l3",
        },
      },
      {
        input: "G1_Kiswahili_T1b_W2_L10",
        expected: {
          grade: "G1",
          gradeNum: 1,
          subject: "Kiswahili",
          term: "1b",
          termOrdinal: 2,
          week: 2,
          lesson: 10,
          slug: "g1-kiswahili-t1b-w2-l10",
        },
      },
    ];
    for (const { input, expected } of cases) {
      const result = parse(input);
      expect(result.ok, input).toBe(true);
      if (!result.ok) continue;
      expect(result.value).toEqual(expected);
    }
  });

  it("strips a file extension before parsing", () => {
    const result = parse("G7_Math_T1a_W1_L1.pdf");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // slug is derived from the extension-stripped name.
    expect(result.value.slug).toBe("g7-math-t1a-w1-l1");
    expect(result.value.subject).toBe("Math");
  });

  it("maps each term token to its chronological ordinal", () => {
    const expected: Record<Term, number> = {
      "1a": 1,
      "1b": 2,
      "2a": 3,
      "2b": 4,
    };
    for (const term of Object.keys(expected) as Term[]) {
      const result = parse(`G7_Science_T${term}_W1_L1`);
      expect(result.ok, term).toBe(true);
      if (!result.ok) continue;
      expect(result.value.term).toBe(term);
      expect(result.value.termOrdinal).toBe(expected[term]);
      expect(result.value.termOrdinal).toBe(TERM_ORDINAL[term]);
    }
  });

  it("rejects malformed names with ok:false", () => {
    const bad = [
      "", // empty
      "   ", // blank
      "Math_G7_T1a_W1_L1", // wrong order
      "G7_Math_T1a_W1", // missing lesson
      "G7_Math_T3a_W1_L1", // invalid term term-number
      "G7_Math_T1c_W1_L1", // invalid term letter
      "G123_Math_T1a_W1_L1", // grade too long (3 digits)
      "G7_Math1_T1a_W1_L1", // subject has a digit
      "g7_math_t1a_w1_l1", // lowercased prefixes (no leading G)
      "G7_Math_T1a_Wx_L1", // non-numeric week
      "G7-Math-T1a-W1-L1", // wrong separator
      "G7_Math_T1a_W1_L1_extra", // trailing segment
    ];
    for (const name of bad) {
      const result = parse(name);
      expect(result.ok, name).toBe(false);
      if (result.ok) continue;
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("buildFilename", () => {
  it("builds the canonical example from numeric grade", () => {
    expect(
      buildFilename({
        grade: 7,
        subject: "Math",
        term: "1a",
        week: 1,
        lesson: 1,
      }),
    ).toBe("G7_Math_T1a_W1_L1");
  });

  it("accepts grade as either 7 or G7, and term as 1a or T1a", () => {
    const fromNum = buildFilename({
      grade: 7,
      subject: "Math",
      term: "1a",
      week: 1,
      lesson: 1,
    });
    const fromStr = buildFilename({
      grade: "G7",
      subject: "Math",
      term: "T1a",
      week: 1,
      lesson: 1,
    });
    expect(fromNum).toBe("G7_Math_T1a_W1_L1");
    expect(fromStr).toBe("G7_Math_T1a_W1_L1");
  });
});

describe("round-trip", () => {
  const names = [
    "G7_Math_T1a_W1_L1",
    "G12_English_T2b_W14_L3",
    "G1_Kiswahili_T1b_W2_L10",
    "G9_Science_T2a_W7_L4",
  ];

  it("buildFilename(parse(x).value) === x for several names", () => {
    for (const name of names) {
      const result = parse(name);
      expect(result.ok, name).toBe(true);
      if (!result.ok) continue;
      expect(buildFilename(result.value)).toBe(name);
    }
  });
});
