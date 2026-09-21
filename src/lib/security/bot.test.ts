import { describe, expect, it } from "vitest";

import { honeypotTripped, submittedTooFast, verifyTurnstile } from "./bot";

describe("honeypotTripped", () => {
  it("ignores empty values", () => {
    expect(honeypotTripped("")).toBe(false);
    expect(honeypotTripped("   ")).toBe(false);
    expect(honeypotTripped(undefined)).toBe(false);
  });

  it("flags filled honeypots", () => {
    expect(honeypotTripped("http://spam.test")).toBe(true);
  });
});

describe("submittedTooFast", () => {
  it("allows missing timestamps (HR / webhook)", () => {
    expect(submittedTooFast(undefined, 10_000)).toBe(false);
  });

  it("rejects sub-2.5s fills", () => {
    expect(submittedTooFast(9_000, 10_000)).toBe(true);
    expect(submittedTooFast(7_000, 10_000)).toBe(false);
  });
});

describe("verifyTurnstile", () => {
  it("skips when no secret is configured", async () => {
    await expect(verifyTurnstile(undefined, undefined, "1.1.1.1")).resolves.toBe(
      true,
    );
  });

  it("fails an empty token when a secret is set", async () => {
    await expect(verifyTurnstile("", "secret", "1.1.1.1")).resolves.toBe(false);
  });
});
