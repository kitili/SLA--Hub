import { describe, expect, it } from "vitest";

import { omitKeys, pickAllowedFields } from "./fields";

describe("pickAllowedFields", () => {
  it("drops unknown keys", () => {
    const input = { notes: "ok", stage: "hired", isAdmin: true };
    expect(pickAllowedFields(input, ["notes"])).toEqual({ notes: "ok" });
  });
});

describe("omitKeys", () => {
  it("removes listed keys", () => {
    expect(omitKeys({ a: 1, b: 2, c: 3 }, ["b"])).toEqual({ a: 1, c: 3 });
  });
});
