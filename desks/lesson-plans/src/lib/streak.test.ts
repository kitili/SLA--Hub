/**
 * Unit tests for the pure streak day-boundary rules — no database, no clock.
 *
 * `advanceStreak` decides the streak from an existing row plus the EAT date
 * key of the submission; `previousDateKey` supplies the "yesterday" boundary.
 * These are the rules `submitFeedback` applies inside its transaction, so the
 * branches pinned here (hold / extend / reset, longest high-water mark) are
 * exactly the ones that were untestable while the action read the wall clock.
 */
import { describe, expect, it } from "vitest";

import { advanceStreak, previousDateKey } from "./streak";

describe("previousDateKey", () => {
  it("steps back one day within a month", () => {
    expect(previousDateKey("2026-06-24")).toBe("2026-06-23");
  });

  it("rolls back across a month boundary", () => {
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
  });

  it("rolls back onto Feb 29 in a leap year", () => {
    expect(previousDateKey("2028-03-01")).toBe("2028-02-29");
  });

  it("rolls back across a year boundary", () => {
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
  });
});

describe("advanceStreak", () => {
  it("starts at 1 when there is no previous row", () => {
    expect(advanceStreak(undefined, "2026-06-24")).toEqual({
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it("starts at 1 when the row exists but has never counted a day", () => {
    const prev = { currentStreak: 0, longestStreak: 0, lastFeedbackDate: null };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it("holds the streak when today was already counted", () => {
    const prev = {
      currentStreak: 4,
      longestStreak: 6,
      lastFeedbackDate: "2026-06-24",
    };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 4,
      longestStreak: 6,
    });
  });

  it("extends the streak when the last counted day was yesterday", () => {
    const prev = {
      currentStreak: 4,
      longestStreak: 6,
      lastFeedbackDate: "2026-06-23",
    };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 5,
      longestStreak: 6,
    });
  });

  it("raises the high-water mark when the extended streak passes it", () => {
    const prev = {
      currentStreak: 6,
      longestStreak: 6,
      lastFeedbackDate: "2026-06-23",
    };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 7,
      longestStreak: 7,
    });
  });

  it("extends across a month boundary (May 31 → June 1)", () => {
    const prev = {
      currentStreak: 2,
      longestStreak: 2,
      lastFeedbackDate: "2026-05-31",
    };
    expect(advanceStreak(prev, "2026-06-01")).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it("extends across a year boundary (Dec 31 → Jan 1)", () => {
    const prev = {
      currentStreak: 9,
      longestStreak: 9,
      lastFeedbackDate: "2025-12-31",
    };
    expect(advanceStreak(prev, "2026-01-01")).toEqual({
      currentStreak: 10,
      longestStreak: 10,
    });
  });

  it("resets to 1 after a gap, keeping the longest streak", () => {
    const prev = {
      currentStreak: 5,
      longestStreak: 8,
      lastFeedbackDate: "2026-06-20",
    };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 1,
      longestStreak: 8,
    });
  });

  it("resets to 1 when the last counted day is in the future (clock skew)", () => {
    // Defensive: a lastFeedbackDate AFTER today is neither today nor
    // yesterday, so it falls into the reset branch rather than extending.
    const prev = {
      currentStreak: 3,
      longestStreak: 3,
      lastFeedbackDate: "2026-06-25",
    };
    expect(advanceStreak(prev, "2026-06-24")).toEqual({
      currentStreak: 1,
      longestStreak: 3,
    });
  });
});
