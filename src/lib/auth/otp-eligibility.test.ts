import { describe, expect, it } from "vitest";

import { assertOtpEligibleEmail } from "./otp-eligibility";

describe("assertOtpEligibleEmail", () => {
  it("accepts any active Silverleaf work email", async () => {
    await expect(assertOtpEligibleEmail("maureen@silverleaf.co.tz")).resolves.toEqual({
      ok: true,
      email: "maureen@silverleaf.co.tz",
    });
    await expect(assertOtpEligibleEmail("Paul.Kimaro@silverleaf.co.tz")).resolves.toEqual({
      ok: true,
      email: "paul.kimaro@silverleaf.co.tz",
    });
  });

  it("rejects a non-work email", async () => {
    await expect(assertOtpEligibleEmail("someone@gmail.com")).resolves.toEqual({
      ok: false,
      error: "invalid-email",
    });
  });
});
