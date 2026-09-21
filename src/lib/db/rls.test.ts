import { describe, expect, it } from "vitest";

import { EMPTY_RLS_CONTEXT, mergeRlsContext } from "./rls";

describe("mergeRlsContext", () => {
  it("overlays hiring token without dropping the session staff id", () => {
    const merged = mergeRlsContext(
      { staffId: "staff-1", isAdmin: true, hiringToken: "" },
      { hiringToken: "tok" },
    );
    expect(merged).toEqual({
      staffId: "staff-1",
      isAdmin: true,
      hiringToken: "tok",
    });
  });

  it("starts from the empty public context", () => {
    expect(mergeRlsContext(EMPTY_RLS_CONTEXT, { staffId: "x" }).staffId).toBe(
      "x",
    );
  });
});
