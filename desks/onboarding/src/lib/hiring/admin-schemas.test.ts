import { describe, expect, it } from "vitest";

import {
  advanceCandidateSchema,
  patchCandidateSchema,
} from "./admin-schemas";
import { parseUuidParam } from "./ids";

describe("hiring admin schemas", () => {
  it("rejects privileged fields on candidate PATCH", () => {
    const parsed = patchCandidateSchema.safeParse({
      notes: "ok",
      stage: "hired",
      culture_token: "steal-me",
      isAdmin: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts the allowlisted PATCH body", () => {
    const parsed = patchCandidateSchema.safeParse({
      notes: "follow up",
      clearCultureMarker: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown advance fields", () => {
    const parsed = advanceCandidateSchema.safeParse({
      action: "culture",
      stage: "hired",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("parseUuidParam", () => {
  it("accepts a uuid", () => {
    expect(parseUuidParam("2c1a7e0a-3c4b-4d5e-8f90-123456789abc")).toBe(
      "2c1a7e0a-3c4b-4d5e-8f90-123456789abc",
    );
  });

  it("rejects crafted ids", () => {
    expect(parseUuidParam("../etc/passwd")).toBeNull();
    expect(parseUuidParam("not-a-uuid")).toBeNull();
  });
});
