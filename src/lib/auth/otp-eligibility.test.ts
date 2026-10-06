import { describe, expect, it, vi } from "vitest";

vi.mock("./ed-admin", () => ({
  verifyEdAdminStaffByEmail: vi.fn(async (email: string) => {
    if (email.endsWith("@silverleaf.co.tz") || email.endsWith("@silverleaf.ac.tz")) {
      return { ok: true, fullName: "Staff", staffId: "1", jobTitle: "Staff" };
    }
    return { ok: false, reason: "not-found" };
  }),
}));

import { assertOtpEligibleEmail } from "./otp-eligibility";

describe("assertOtpEligibleEmail", () => {
  it("accepts a Silverleaf work email that Ed Admin knows", async () => {
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
