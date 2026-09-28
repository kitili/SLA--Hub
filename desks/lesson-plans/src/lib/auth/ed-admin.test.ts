/**
 * Unit tests for the ed-admin directory parser + sign-in verifier.
 *
 * `fetch` is stubbed so no network is hit; `@/lib/env` is mocked to supply a
 * token. The in-memory directory cache is cleared between tests.
 *
 * `server-only` is silenced via vitest.config.ts `conditions: ["react-server"]`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    ED_ADMIN_API_TOKEN: "test-token",
    ED_ADMIN_STAFF_API_URL: undefined,
  },
}));

import {
  __clearEdAdminCache,
  parseStaffXml,
  verifyEdAdminStaff,
} from "./ed-admin";

const FIXTURE_XML = `<root>
  <staff><ID>401402</ID><Title>Ms</Title><FirstName>Krupa</FirstName><LastName>Patel</LastName><Position>CEO</Position><Disabled>0</Disabled><Email>Krupa@Silverleaf.co.tz</Email><StatusName>Current</StatusName></staff>
  <staff><ID>500001</ID><FirstName>Old</FirstName><LastName>Leaver</LastName><Position></Position><Disabled>0</Disabled><Email>old.leaver@silverleaf.co.tz</Email><StatusName>Left</StatusName></staff>
  <staff><ID>500002</ID><FirstName>Dis</FirstName><LastName>Abled</LastName><Position></Position><Disabled>1</Disabled><Email>dis.abled@silverleaf.co.tz</Email><StatusName>Current</StatusName></staff>
</root>`;

/** Stub global fetch to return the given body/status. */
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

describe("parseStaffXml", () => {
  it("extracts each record's fields", () => {
    const staff = parseStaffXml(FIXTURE_XML);
    expect(staff).toHaveLength(3);
    expect(staff[0]).toMatchObject({
      id: "401402",
      email: "Krupa@Silverleaf.co.tz",
      firstName: "Krupa",
      lastName: "Patel",
      position: "CEO",
      statusName: "Current",
      disabled: false,
    });
    expect(staff[2]?.disabled).toBe(true);
  });

  it("returns [] for empty / malformed input", () => {
    expect(parseStaffXml("")).toEqual([]);
    expect(parseStaffXml("<root></root>")).toEqual([]);
  });
});

describe("verifyEdAdminStaff", () => {
  it("accepts a matching email + ID on an active record (case-insensitive email)", async () => {
    const result = await verifyEdAdminStaff("krupa@silverleaf.co.tz", "401402");
    expect(result).toEqual({
      ok: true,
      fullName: "Krupa Patel",
      staffId: "401402",
      jobTitle: "CEO",
    });
  });

  it("rejects a known email with the wrong ID as not-found", async () => {
    const result = await verifyEdAdminStaff("krupa@silverleaf.co.tz", "999999");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("rejects an unknown email as not-found", async () => {
    const result = await verifyEdAdminStaff("nobody@silverleaf.co.tz", "401402");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("rejects a staff member who has Left as inactive", async () => {
    const result = await verifyEdAdminStaff("old.leaver@silverleaf.co.tz", "500001");
    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("rejects a disabled staff member as inactive", async () => {
    const result = await verifyEdAdminStaff("dis.abled@silverleaf.co.tz", "500002");
    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("returns api-error when the directory cannot be fetched", async () => {
    stubFetch("nope", 500);
    const result = await verifyEdAdminStaff("krupa@silverleaf.co.tz", "401402");
    expect(result).toEqual({ ok: false, reason: "api-error" });
  });
});
