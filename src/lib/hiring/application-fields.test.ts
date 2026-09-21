import { describe, expect, it } from "vitest";

import { buildApplicationNotes } from "./application-fields";
import { createCandidateSchema } from "./admin-schemas";

describe("buildApplicationNotes", () => {
  it("joins filled fields and ignores blanks", () => {
    const notes = buildApplicationNotes(
      {
        whatsapp: "+2551",
        location: "Dar",
        whySilverleaf: "mission",
      },
      { source: "Hiring /apply form" },
    );
    expect(notes).toContain("Phone: +2551");
    expect(notes).toContain("Location: Dar");
    expect(notes).toContain("Why Silverleaf:\nmission");
    expect(notes).toContain("Source: Hiring /apply form");
    expect(notes).not.toContain("Employed:");
  });
});

describe("createCandidateSchema", () => {
  it("rejects privileged fields", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      stage: "hired",
      culture_token: "steal",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps apply-form extras so HR manual entry can store notes", () => {
    const parsed = createCandidateSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      roleApplied: "Teacher",
      whatsapp: "+2551",
      location: "Dar",
      website: "",
      formStartedAt: Date.now(),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.whatsapp).toBe("+2551");
      expect(parsed.data.location).toBe("Dar");
    }
  });
});
