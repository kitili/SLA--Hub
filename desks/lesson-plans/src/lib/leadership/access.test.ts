import { describe, expect, it } from "vitest";

import { canViewLeadership, checkIngestAuth, leadershipViewerEmails } from "./access";

const KEY = "k".repeat(40);

describe("checkIngestAuth", () => {
  it("accepts the exact bearer key", () => {
    expect(checkIngestAuth(`Bearer ${KEY}`, KEY)).toBe("ok");
    expect(checkIngestAuth(`bearer   ${KEY}  `, KEY)).toBe("ok");
  });

  it("denies a wrong, partial, extended, missing or malformed key", () => {
    for (const header of [
      `Bearer ${KEY}x`, `Bearer ${KEY.slice(1)}`, "Bearer ", "Bearer", KEY, `Basic ${KEY}`, "", null,
    ]) {
      expect(checkIngestAuth(header, KEY), String(header)).toBe("denied");
    }
  });

  it("fails closed when no key, or a short key, is configured", () => {
    expect(checkIngestAuth("Bearer anything", undefined)).toBe("unconfigured");
    expect(checkIngestAuth("Bearer short", "short")).toBe("unconfigured");
    expect(checkIngestAuth("Bearer ", "   ")).toBe("unconfigured");
  });
});

describe("canViewLeadership", () => {
  it("lets admins and instructional leaders in, nobody else", () => {
    expect(canViewLeadership({ isAdmin: true, roles: ["admin"] })).toBe(true);
    expect(canViewLeadership({ isAdmin: false, roles: ["instructional-leader"] })).toBe(true);
    expect(canViewLeadership({ isAdmin: false, roles: ["campus-lead"] })).toBe(false);
    expect(canViewLeadership({ isAdmin: false, roles: [] })).toBe(false);
    expect(canViewLeadership(null)).toBe(false);
  });

  it("lets listed viewers in by email, case-insensitively, and nobody else", () => {
    const viewers = leadershipViewerEmails(" Principal@Silverleaf.co.tz , ,coach@silverleaf.co.tz");
    expect(viewers).toEqual(["principal@silverleaf.co.tz", "coach@silverleaf.co.tz"]);
    const staff = { isAdmin: false, roles: [] as string[] };
    expect(canViewLeadership({ ...staff, email: "PRINCIPAL@silverleaf.co.tz " }, viewers)).toBe(true);
    expect(canViewLeadership({ ...staff, email: "teacher@silverleaf.co.tz" }, viewers)).toBe(false);
    expect(canViewLeadership({ ...staff, email: "" }, [""])).toBe(false);
    expect(canViewLeadership({ ...staff, email: null }, viewers)).toBe(false);
    expect(canViewLeadership(staff, viewers)).toBe(false);
  });
});
