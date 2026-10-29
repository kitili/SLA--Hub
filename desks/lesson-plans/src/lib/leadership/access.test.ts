import { describe, expect, it } from "vitest";

import { canViewLeadership, checkIngestAuth } from "./access";

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
});
