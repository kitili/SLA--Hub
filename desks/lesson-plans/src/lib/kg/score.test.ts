import { describe, expect, it } from "vitest";

import { bandOf, catIndex, catScaled, scoreRound } from "./score";

describe("KG checklist scoring", () => {
  it("keeps the age bands used by the teacher app", () => {
    expect(bandOf(36)).toBeNull();
    expect(bandOf(37)).toBe("A");
    expect(bandOf(49)).toBe("B");
    expect(bandOf(71)).toBe("C");
    expect(bandOf(72)).toBeNull();
  });

  it("maps scaled scores and the Development Index onto the same five bands", () => {
    expect(catScaled(3)).toBe(0);
    expect(catScaled(7)).toBe(2);
    expect(catScaled(19)).toBe(4);
    expect(catIndex(69)).toBe(0);
    expect(catIndex(100)).toBe(2);
    expect(catIndex(130)).toBe(4);
  });

  it("does not invent an index for a half-finished assessment", () => {
    const round = scoreRound(
      {
        dob: "2022-01-15",
        assessments: { "0": { date: "2026-03-01" } },
        marks: { "0": { "GM.1": "y" } },
      },
      0,
    );
    expect(round.status).toBe("progress");
    expect(round.indexNum).toBeNull();
    expect(round.flagged).toBe(false);
  });
});
