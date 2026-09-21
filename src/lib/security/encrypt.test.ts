import { describe, expect, it } from "vitest";

import { decryptString, encryptString } from "./encrypt";

describe("encryptString / decryptString", () => {
  it("round-trips plaintext", () => {
    const cipher = encryptString("TZ-12345678");
    expect(cipher).toMatch(/^enc:v1:/);
    expect(cipher).not.toContain("TZ-12345678");
    expect(decryptString(cipher)).toBe("TZ-12345678");
  });

  it("leaves legacy plaintext readable", () => {
    expect(decryptString("already-plain")).toBe("already-plain");
  });

  it("is a no-op for empty values", () => {
    expect(encryptString("")).toBe("");
    expect(encryptString(null)).toBeNull();
    expect(decryptString(null)).toBeNull();
  });
});
