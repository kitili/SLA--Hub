import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ACADEMICS_CACHE, ACADEMICS_CACHE_MARKER, isAcademicsBoardPath } from "./academics-offline";

describe("Academics board paths", () => {
  it("keeps the four dashboards and leaves the rest of Academics alone", () => {
    expect(isAcademicsBoardPath("/en/feedback")).toBe(true);
    expect(isAcademicsBoardPath("/sw/curriculum/")).toBe(true);
    expect(isAcademicsBoardPath("/en/kg")).toBe(true);
    expect(isAcademicsBoardPath("/en/assessment")).toBe(true);
    expect(isAcademicsBoardPath("/en/lesson-plans")).toBe(false);
    expect(isAcademicsBoardPath("/en/sign-in")).toBe(false);
    expect(isAcademicsBoardPath("/en/admin")).toBe(false);
    expect(isAcademicsBoardPath("/kg")).toBe(false);
  });

  it("uses the same cache name and marker as the service worker", () => {
    const worker = readFileSync(path.join(process.cwd(), "public/academics-offline.js"), "utf8");
    expect(worker).toContain(ACADEMICS_CACHE);
    expect(worker).toContain(ACADEMICS_CACHE_MARKER);
    expect(worker).toContain(String.raw`^\/(en|sw)\/(feedback|curriculum|kg|assessment)\/?$`);
  });
});
