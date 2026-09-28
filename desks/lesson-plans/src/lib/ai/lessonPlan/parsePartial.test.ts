/**
 * Unit tests for parsePartial, the streaming-JSON repairer behind the Studio's
 * live preview. The interesting axis is WHERE the stream got cut: mid-string,
 * mid-escape, mid-key, mid-array, after a comma, deep inside nesting — plus
 * the escape handling that keeps brackets inside prose from corrupting the
 * close-bracket stack.
 */
import { describe, expect, it } from "vitest";

import { parsePartial } from "./parsePartial";

describe("parsePartial", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(parsePartial("")).toBeNull();
    expect(parsePartial("   \n\t ")).toBeNull();
  });

  it("parses already-valid JSON unchanged (with surrounding whitespace)", () => {
    expect(parsePartial('  {"knows": ["a", "b"]}\n')).toEqual({
      knows: ["a", "b"],
    });
  });

  it("returns null for non-JSON garbage", () => {
    expect(parsePartial("not json at all")).toBeNull();
  });

  it("repairs a bare opening brace to the empty object", () => {
    expect(parsePartial("{")).toEqual({});
  });

  it("closes a string truncated mid-value", () => {
    expect(parsePartial('{"assessment_method": "Observe stud')).toEqual({
      assessment_method: "Observe stud",
    });
  });

  it("closes a string truncated mid-array element", () => {
    expect(parsePartial('{"knows": ["a", "b')).toEqual({ knows: ["a", "b"] });
  });

  it("drops a trailing comma (with trailing whitespace) before closing", () => {
    expect(parsePartial('{"knows": ["a",')).toEqual({ knows: ["a"] });
    expect(parsePartial('{"knows": ["a"],\n  ')).toEqual({ knows: ["a"] });
    expect(parsePartial('{"identifier": {"title": "Counting", ')).toEqual({
      identifier: { title: "Counting" },
    });
  });

  it("closes every level of a deep object truncation in stack order", () => {
    expect(
      parsePartial('{"teaching_sequence": {"i_do": {"depth": "Surface", "text": "Sta'),
    ).toEqual({
      teaching_sequence: { i_do: { depth: "Surface", text: "Sta" } },
    });
  });

  it("closes an array-of-objects truncation (object → array → object)", () => {
    expect(
      parsePartial(
        '{"misconceptions": [{"misconception": "All groups equal", "description": "Learners assu',
      ),
    ).toEqual({
      misconceptions: [
        { misconception: "All groups equal", description: "Learners assu" },
      ],
    });
  });

  it("finishes a truncated number", () => {
    expect(parsePartial('{"meta": {"source_lesson_idx": 3')).toEqual({
      meta: { source_lesson_idx: 3 },
    });
  });

  it("keeps escaped quotes inside a dangling string intact", () => {
    expect(parsePartial('{"knows": ["say \\"many\\" aloud')).toEqual({
      knows: ['say "many" aloud'],
    });
  });

  it("handles an escaped backslash right before the cut", () => {
    expect(parsePartial('{"knows": ["path \\\\')).toEqual({
      knows: ["path \\"],
    });
  });

  it("ignores brackets inside strings when closing the stack", () => {
    expect(parsePartial('{"knows": ["array [1, 2", "brace {x')).toEqual({
      knows: ["array [1, 2", "brace {x"],
    });
  });

  it("returns null (not garbage) for unrepairable cuts: mid-key, dangling key, mid-escape", () => {
    // Mid-key: closing the string yields {"succ"} — still invalid.
    expect(parsePartial('{"succ')).toBeNull();
    // Complete key with no colon/value.
    expect(parsePartial('{"knows"')).toBeNull();
    expect(parsePartial('{"knows":')).toBeNull();
    // Cut in the middle of an escape sequence: the appended quote gets escaped.
    expect(parsePartial('{"knows": ["say \\')).toBeNull();
  });

  it("never throws across every prefix of a realistic stream, and lands exactly", () => {
    const full = JSON.stringify({
      identifier: { title: 'Compare "many" and "few"', grade: "1" },
      success_criteria: ["Students can compare groups."],
      misconceptions: [{ misconception: "m", description: "d [sic]" }],
      teaching_sequence: {
        introduction_hook: { depth: "Surface", text: "Show \\ two trays", checkpoint: "Which has many?" },
      },
      meta: { source_lesson_idx: 0, gaps_flagged: [] },
    });
    let parsedCount = 0;
    for (let len = 1; len <= full.length; len += 1) {
      const draft = parsePartial(full.slice(0, len));
      if (draft !== null) {
        parsedCount += 1;
        expect(typeof draft).toBe("object");
      }
    }
    // A healthy share of prefixes must be repairable (cuts inside keys are
    // not) — the preview relies on frequent successful re-parses.
    expect(parsedCount).toBeGreaterThan(full.length / 4);
    expect(parsePartial(full)).toEqual(JSON.parse(full));
  });
});
