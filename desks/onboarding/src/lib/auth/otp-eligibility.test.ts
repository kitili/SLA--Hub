/**
 * OTP eligibility uses the live ed-admin directory, not the local staff table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    ED_ADMIN_API_TOKEN: "test-token",
    ED_ADMIN_STAFF_API_URL: undefined,
  },
}));

import { __clearEdAdminCache } from "./ed-admin";
import { assertOtpEligibleEmail } from "./otp-eligibility";

const FIXTURE_XML = `<root>
  <staff><ID>401402</ID><Title>Ms</Title><FirstName>Krupa</FirstName><LastName>Patel</LastName><Position>CEO</Position><Disabled>0</Disabled><Email>Krupa@Silverleaf.co.tz</Email><StatusName>Current</StatusName></staff>
  <staff><ID>500001</ID><FirstName>Old</FirstName><LastName>Leaver</LastName><Position></Position><Disabled>0</Disabled><Email>old.leaver@silverleaf.co.tz</Email><StatusName>Left</StatusName></staff>
</root>`;

function stubFetch(body: string, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status })),
  );
}

beforeEach(() => {
  __clearEdAdminCache();
  stubFetch(FIXTURE_XML);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertOtpEligibleEmail", () => {
  it("accepts an active ed-admin email that is not in the local staff table", async () => {
    const result = await assertOtpEligibleEmail("krupa@silverleaf.co.tz");
    expect(result).toEqual({
      ok: true,
      email: "krupa@silverleaf.co.tz",
      fullName: "Krupa Patel",
      staffId: "401402",
      jobTitle: "CEO",
    });
  });

  it("rejects a non-work email", async () => {
    await expect(assertOtpEligibleEmail("someone@gmail.com")).resolves.toEqual({
      ok: false,
      error: "invalid-email",
    });
  });

  it("rejects an unknown work email", async () => {
    await expect(
      assertOtpEligibleEmail("nobody@silverleaf.co.tz"),
    ).resolves.toEqual({ ok: false, error: "not-found" });
  });

  it("rejects an inactive staff email", async () => {
    await expect(
      assertOtpEligibleEmail("old.leaver@silverleaf.co.tz"),
    ).resolves.toEqual({ ok: false, error: "inactive" });
  });

  it("maps directory fetch failures", async () => {
    stubFetch("nope", 500);
    await expect(
      assertOtpEligibleEmail("krupa@silverleaf.co.tz"),
    ).resolves.toEqual({ ok: false, error: "directory-unavailable" });
  });
});
