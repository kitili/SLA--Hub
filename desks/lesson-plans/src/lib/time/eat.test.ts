/**
 * Unit tests for the EAT "Feedback Hour" helper — pure, no I/O.
 *
 * EAT is `Africa/Dar_es_Salaam`, a fixed UTC+3 with no DST, so the UTC→EAT
 * offset is a constant +3 hours. We pin instants with `new Date(Date.UTC(...))`
 * and assert against the expected EAT wall-clock, including a case where the
 * UTC day and the EAT day differ.
 *
 * Reminder: the Feedback Hour window is the half-open interval [15:00, 17:00)
 * in EAT.
 */
import { describe, it, expect } from "vitest";

import { FEEDBACK_WINDOW, eatNow, isFeedbackHour } from "./eat";

describe("FEEDBACK_WINDOW", () => {
  it("is the [15:00, 17:00) EAT window", () => {
    expect(FEEDBACK_WINDOW).toEqual({ startHour: 15, endHour: 17 });
  });
});

describe("isFeedbackHour", () => {
  it("is false at 14:59 EAT (11:59 UTC) — just before the window opens", () => {
    expect(isFeedbackHour(new Date(Date.UTC(2026, 5, 24, 11, 59)))).toBe(false);
  });

  it("is true at 15:00 EAT (12:00 UTC) — the window opens (inclusive)", () => {
    expect(isFeedbackHour(new Date(Date.UTC(2026, 5, 24, 12, 0)))).toBe(true);
  });

  it("is true at 16:59 EAT (13:59 UTC) — last minute inside the window", () => {
    expect(isFeedbackHour(new Date(Date.UTC(2026, 5, 24, 13, 59)))).toBe(true);
  });

  it("is false at 17:00 EAT (14:00 UTC) — the window closes (exclusive)", () => {
    expect(isFeedbackHour(new Date(Date.UTC(2026, 5, 24, 14, 0)))).toBe(false);
  });
});

describe("eatNow", () => {
  it("returns EAT wall-clock hour and minute (+3 vs UTC)", () => {
    const result = eatNow(new Date(Date.UTC(2026, 5, 24, 12, 30)));
    expect(result.hour).toBe(15);
    expect(result.minute).toBe(30);
  });

  it("dateKey is the EAT calendar date for a same-day instant", () => {
    // 12:00 UTC = 15:00 EAT, still 2026-06-24 in both zones.
    expect(eatNow(new Date(Date.UTC(2026, 5, 24, 12, 0))).dateKey).toBe(
      "2026-06-24",
    );
  });

  it("dateKey rolls to the next EAT day when UTC is still the previous day", () => {
    // 21:30 UTC on 2026-06-24 = 00:30 EAT on 2026-06-25.
    const result = eatNow(new Date(Date.UTC(2026, 5, 24, 21, 30)));
    expect(result.dateKey).toBe("2026-06-25");
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(30);
  });
});
