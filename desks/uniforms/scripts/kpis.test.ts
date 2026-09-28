import assert from "node:assert/strict";
import { test } from "node:test";
import { weeklyPack } from "../src/lib/briefing";
import { daysBetween, pct, type KpiReport } from "../src/lib/kpis";

test("days between dates", () => {
  const from = new Date("2026-01-21T08:00:00.000Z");
  const to = new Date("2026-08-30T00:00:00.000Z");
  assert.equal(daysBetween(from, to), 220);
  assert.equal(daysBetween(to, from), 0);
});

test("percent rounded", () => {
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(0, 10), 0);
  assert.equal(pct(5, 0), 0);
});

test("weekly pack names coverage and money", () => {
  const text = weeklyPack({
    asOf: new Date("2026-08-30T00:00:00.000Z"),
    campusCode: null,
    campusName: null,
    enrolled: 540,
    onFile: 6,
    withKit: 1,
    coveragePct: 0,
    quietCampuses: ["Boma", "Ilboru"],
    paymentsTzs: 85000,
    outstandingTzs: 30000,
    readyToCollect: 1,
    lowSizes: 20,
    readyList: [{ ref: "ORD-1001", studentName: "Amina Juma", campusName: "Usa River", status: "PAID", days: 220, ready: true, outstandingTzs: 0 }],
  } as KpiReport);
  assert.match(text, /All five campuses/);
  assert.match(text, /Kit coverage: 0%/);
  assert.match(text, /Quiet campuses: Boma, Ilboru/);
  assert.match(text, /ORD-1001/);
});
