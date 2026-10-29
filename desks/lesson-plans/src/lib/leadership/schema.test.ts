import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { samplePayload } from "./fixtures";
import { MAX_INGEST_BYTES, parseLeadershipPayload } from "./schema";

describe("leadership payload schema", () => {
  it("accepts a well-formed payload and drops unknown keys", () => {
    const result = parseLeadershipPayload({ ...samplePayload(), buildMs: 812, fromCache: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).not.toHaveProperty("buildMs");
  });

  it("rejects dates that are not yyyy-mm-dd", () => {
    const bad = samplePayload();
    bad.walkthroughs[0]!.date = "03/02/2026";
    expect(parseLeadershipPayload(bad).ok).toBe(false);
  });

  it("rejects source links that are not https Google links (stored-XSS guard)", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://docs.google.com/spreadsheets/d/x",
      "https://evil.example.com/sheet",
      "data:text/html,<script>alert(1)</script>",
      "not a url",
    ]) {
      const bad = samplePayload();
      bad.sources[0]!.url = url;
      expect(parseLeadershipPayload(bad).ok, url).toBe(false);
    }
  });

  it("rejects oversized text and lists", () => {
    const longNote = samplePayload();
    longNote.walkthroughs[0]!.glows = "x".repeat(5001);
    expect(parseLeadershipPayload(longNote).ok).toBe(false);

    const tooManyCampuses = samplePayload({ campuses: Array.from({ length: 21 }, (_, i) => `C${i}`) });
    expect(parseLeadershipPayload(tooManyCampuses).ok).toBe(false);
  });

  it("rejects wrong types and missing sections without throwing", () => {
    for (const body of [null, "x", 5, [], {}, { ...samplePayload(), obsRules: "no" }]) {
      expect(parseLeadershipPayload(body).ok).toBe(false);
    }
    const missing = parseLeadershipPayload({});
    if (!missing.ok) expect(missing.issues.length).toBeGreaterThan(0);
  });

  it("keeps the ingest size cap under Vercel's 4.5 MB body limit", () => {
    expect(MAX_INGEST_BYTES).toBeLessThan(4_500_000);
  });
});

/**
 * Contract test: whatever the unmodified Apps Script (Code.gs) produces from
 * tracker grids must be accepted by the hub, or pushToHub would be refused.
 */
describe("Apps Script payload contract", () => {
  const source = readFileSync(
    path.join(process.cwd(), "integrations/instructional-leadership/Code.gs"),
    "utf8",
  );
  const mod = { exports: {} as Record<string, unknown> };
  new Function("module", source)(mod);
  const { buildPayload, CONFIG } = mod.exports as {
    buildPayload: (src: unknown, cfg: unknown) => Record<string, unknown>;
    CONFIG: Record<string, unknown>;
  };

  const walkHeader = [
    "Timestamp", "Date of Walkthrough", "Term", "Campus", "Who is present", "Roles present", "Facilitator",
    "AM or PM", "Glows", "Grows", "PD Focus Category", "Assign PD to", "PD completion target date", "Other notes",
  ];
  const obsHeader = [
    "Timestamp", "What is the date?", "Teacher Name", "Grade?", "Observer?", "What type of form",
    "Subject Observed", "Is this a culture/management or learning/rigor", "What kind of culture/management",
    "What kind of learning/rigor",
  ];

  it("builds a payload the hub accepts", () => {
    const payload = buildPayload(
      {
        walk: {
          responses: [
            walkHeader,
            ["2026-02-03T08:00:00Z", "2026-02-03", "Term 1A", "Usa River", "Grace", "Principal", "GRACE  KAMBONA", "AM", "Calm", "Tickets", "Narrating the positive", "Irene", "2026-02-20", ""],
          ],
          setup: [["Term", "Label", "Start Date", "End Date"], ["Term 1A", "T1A", "12/01/2026", "06/03/2026"]],
          pd: [["Management Trajectory", "Rigor Trajectory"], ["Narrating the positive", "Checking for understanding"]],
          dashboard: [["Campus", "Term 1A"], ["Usa River", 36], ["Network"]],
        },
        obs: {
          tabs: {
            "Usa River": [obsHeader, ["", "2026-02-04", "Irene Didass", "Grade 2", "Grace Kambona", "Formal", "Math", "Learning/Rigor", "", "Checking for understanding"]],
          },
          setup: [["Campus Name", "Role", "Coach Full Name"], ["Usa River Campus", "Teacher", "Irene Didass"]],
          dashboard: [["Start Date:", "12/01/2026", "End Date:", "04/12/2026"]],
        },
      },
      CONFIG,
    );
    const result = parseLeadershipPayload({
      ...payload,
      generatedAt: new Date().toISOString(),
      sources: [{ key: "walk", name: "Tracker", url: "https://docs.google.com/spreadsheets/d/x/edit", updated: new Date().toISOString() }],
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect((payload.walkthroughs as unknown[]).length).toBe(1);
    expect((payload.walkOffline as unknown[]).length).toBe(1);
  });
});
