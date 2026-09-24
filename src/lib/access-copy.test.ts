import { describe, expect, it } from "vitest";
import { accessActionLabel, accessEventTitle } from "./access-copy";

describe("accessActionLabel", () => {
  it("names sign-in and desk entry", () => {
    expect(accessActionLabel("signed_in")).toBe("Signed in");
    expect(accessActionLabel("opened_desk")).toBe("Opened dashboard");
    expect(accessActionLabel("opened_hub")).toBe("Opened hub");
  });

  it("names the dashboard that was opened", () => {
    expect(accessEventTitle("opened_desk", "Marketing")).toBe("Opened Marketing");
    expect(accessEventTitle("opened_hub")).toBe("Opened hub home");
  });
});
