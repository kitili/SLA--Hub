/**
 * Unit tests for riskLevel() — the pure onboarding risk classifier.
 *
 * No I/O, no DB. All time is injected via `now` so tests are deterministic.
 *
 * Constants reminder (from at-risk.ts):
 *   RAMP_DAYS       = 42
 *   GREEN_BAND      = 10   (points behind before leaving green)
 *   ORANGE_BAND     = 25   (points behind before turning red)
 *   STALE_LOGIN_DAYS = 7   (days without login → at least orange)
 */
import { describe, it, expect } from "vitest";
import {
  riskLevel,
  expectedCompletionPct,
  RAMP_DAYS,
  STALE_LOGIN_DAYS,
} from "./at-risk";

/** Build a Date exactly `days` days before `now`. */
function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

const NOW = new Date("2025-01-21T12:00:00Z");

describe("expectedCompletionPct", () => {
  it("returns 0 at day 0", () => {
    expect(expectedCompletionPct(0)).toBe(0);
  });

  it("returns 50 at day 21 (halfway through ramp)", () => {
    // 21 / 42 * 100 = 50
    expect(expectedCompletionPct(21)).toBeCloseTo(50, 5);
  });

  it("caps at 100 past the ramp", () => {
    expect(expectedCompletionPct(RAMP_DAYS)).toBe(100);
    expect(expectedCompletionPct(RAMP_DAYS + 10)).toBe(100);
  });

  it("returns 0 for negative days (defensive)", () => {
    expect(expectedCompletionPct(-5)).toBe(0);
  });
});

describe("riskLevel — not started", () => {
  it("is green when startedAt is null (not started yet)", () => {
    expect(
      riskLevel({ startedAt: null, completionPct: 0, lastActiveAt: null, now: NOW }),
    ).toBe("green");
  });

  it("is green when startedAt is undefined", () => {
    expect(
      riskLevel({ startedAt: undefined, completionPct: 0, lastActiveAt: null, now: NOW }),
    ).toBe("green");
  });
});

describe("riskLevel — green cases", () => {
  it("is green on day 0 with 0% completion (nothing expected yet)", () => {
    // Day 0 → expected = 0; shortfall = 0 → green
    const start = new Date(NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 0, lastActiveAt: NOW, now: NOW }),
    ).toBe("green");
  });

  it("is green when completion is at the expected value (no shortfall)", () => {
    // 14 days in: expected = 14/42*100 ≈ 33.3; 34% actual → shortfall ≈ -0.7 → green
    const start = daysAgo(14, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 34, lastActiveAt: NOW, now: NOW }),
    ).toBe("green");
  });

  it("is green when shortfall is exactly at the GREEN_BAND boundary", () => {
    // 21 days in: expected = 50; actual = 40 → shortfall = 10 = GREEN_BAND
    // Rule: shortfall > GREEN_BAND → orange; at exactly 10, it is NOT > 10 → green
    const start = daysAgo(21, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 40, lastActiveAt: NOW, now: NOW }),
    ).toBe("green");
  });

  it("is green when 100% complete even with recent-ish login", () => {
    const start = daysAgo(30, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 100, lastActiveAt: NOW, now: NOW }),
    ).toBe("green");
  });

  it("is green when 100% complete and past RAMP_DAYS (done = not overdue)", () => {
    // Complete members past the ramp should be green (done), not red
    const start = daysAgo(RAMP_DAYS + 5, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 100, lastActiveAt: NOW, now: NOW }),
    ).toBe("green");
  });
});

describe("riskLevel — orange cases", () => {
  it("is orange when shortfall is just over GREEN_BAND", () => {
    // 21 days in: expected = 50; actual = 39 → shortfall = 11 > 10 → orange
    const start = daysAgo(21, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 39, lastActiveAt: NOW, now: NOW }),
    ).toBe("orange");
  });

  it("is orange when shortfall is exactly at ORANGE_BAND boundary", () => {
    // 21 days in: expected = 50; actual = 25 → shortfall = 25 = ORANGE_BAND
    // Rule: shortfall > ORANGE_BAND → red; at 25 → NOT > 25 → orange
    const start = daysAgo(21, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 25, lastActiveAt: NOW, now: NOW }),
    ).toBe("orange");
  });

  it(`is orange when inactive for exactly ${STALE_LOGIN_DAYS} days while incomplete`, () => {
    // On-schedule completion but last login was STALE_LOGIN_DAYS ago → orange
    const start = daysAgo(14, NOW);
    // 14 days in expected ≈ 33; actual = 34 → within green band
    // But last login was 7 days ago → orange (stale login rule)
    const lastActive = daysAgo(STALE_LOGIN_DAYS, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 34, lastActiveAt: lastActive, now: NOW }),
    ).toBe("orange");
  });

  it("is orange when inactive for more than STALE_LOGIN_DAYS while incomplete", () => {
    const start = daysAgo(10, NOW);
    const lastActive = daysAgo(STALE_LOGIN_DAYS + 3, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 30, lastActiveAt: lastActive, now: NOW }),
    ).toBe("orange");
  });

  it("is NOT orange when inactive if already complete (stale-login only for incomplete)", () => {
    // Completed members are exempt from the stale-login orange rule
    const start = daysAgo(20, NOW);
    const lastActive = daysAgo(30, NOW); // very stale
    expect(
      riskLevel({ startedAt: start, completionPct: 100, lastActiveAt: lastActive, now: NOW }),
    ).toBe("green");
  });
});

describe("riskLevel — red cases", () => {
  it("is red when shortfall is just over ORANGE_BAND", () => {
    // 21 days in: expected = 50; actual = 24 → shortfall = 26 > 25 → red
    const start = daysAgo(21, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 24, lastActiveAt: NOW, now: NOW }),
    ).toBe("red");
  });

  it("is red when past RAMP_DAYS and still incomplete", () => {
    // Past 42 days with only 99% done → overdue → red
    const start = daysAgo(RAMP_DAYS + 1, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 99, lastActiveAt: NOW, now: NOW }),
    ).toBe("red");
  });

  it("is red when past RAMP_DAYS with 0% completion", () => {
    const start = daysAgo(RAMP_DAYS + 10, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 0, lastActiveAt: null, now: NOW }),
    ).toBe("red");
  });

  it("is red before RAMP_DAYS when far behind (shortfall > ORANGE_BAND)", () => {
    // Day 7: expected ≈ 16.7; actual = 0 → shortfall ≈ 16.7 (under 25) → orange
    // Day 21: expected = 50; actual = 0 → shortfall = 50 > 25 → red
    const start = daysAgo(21, NOW);
    expect(
      riskLevel({ startedAt: start, completionPct: 0, lastActiveAt: null, now: NOW }),
    ).toBe("red");
  });
});

describe("riskLevel — severity ordering (worst wins)", () => {
  it("red beats orange: past-ramp AND stale-login → red", () => {
    const start = daysAgo(RAMP_DAYS + 5, NOW);
    const lastActive = daysAgo(STALE_LOGIN_DAYS + 2, NOW);
    // Overdue (red trigger) beats stale-login (orange trigger)
    expect(
      riskLevel({ startedAt: start, completionPct: 50, lastActiveAt: lastActive, now: NOW }),
    ).toBe("red");
  });
});
