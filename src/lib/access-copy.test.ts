import { describe, expect, it } from "vitest";
import { accessActionLabel } from "./access-copy";

describe("accessActionLabel", () => {
  it("names sign-in and desk entry", () => {
    expect(accessActionLabel("signed_in")).toBe("Signed in");
    expect(accessActionLabel("opened_desk")).toBe("Entered");
    expect(accessActionLabel("opened_hub")).toBe("Opened hub");
  });
});
