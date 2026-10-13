import { describe, expect, it } from "vitest";

import { headlineMetric, readingBand } from "./metrics";

describe("assessment headline metrics", () => {
  it("uses familiar-word fluency for kindergarten reading", () => {
    const metric = headlineMetric("EGRA", "KG", {
      subtasks: [
        { name: "Oral reading", type: "timed", metric: "CWPM", fluency: 40 },
        { name: "Familiar words", type: "timed", metric: "CWPM", fluency: 12 },
      ],
    });
    expect(metric.value).toBe(12);
    expect(metric.band).toBe("Beginning (1–19)");
  });

  it("drops the legacy Grade 2 story score when the app version is missing", () => {
    const metric = headlineMetric("EGRA", "G2", {
      subtasks: [{ name: "Oral reading fluency", type: "timed", metric: "CWPM", fluency: 30 }],
    });
    expect(metric.value).toBeNull();
    expect(readingBand(45)).toBe("Fluent (45+)");
  });

  it("turns a social-emotional total into a percentage", () => {
    expect(headlineMetric("SEL", "G3", { sel_total: 12, sel_max: 16 }).value).toBe(75);
  });
});
