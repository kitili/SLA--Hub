import { describe, expect, it } from "vitest";

import { resetRateLimitBuckets, takeToken } from "./rate-limit";

describe("takeToken", () => {
  it("allows up to the limit then rejects", () => {
    resetRateLimitBuckets();
    expect(takeToken("a", 2, 60_000, 1_000)).toBe(true);
    expect(takeToken("a", 2, 60_000, 1_100)).toBe(true);
    expect(takeToken("a", 2, 60_000, 1_200)).toBe(false);
  });

  it("slides the window", () => {
    resetRateLimitBuckets();
    expect(takeToken("b", 1, 100, 0)).toBe(true);
    expect(takeToken("b", 1, 100, 50)).toBe(false);
    expect(takeToken("b", 1, 100, 101)).toBe(true);
  });
});
