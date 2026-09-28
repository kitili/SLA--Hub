/**
 * Unit tests for extractive briefing scripts and file-type gating.
 */
import { describe, expect, it } from "vitest";

import {
  buildExtractiveBriefing,
  isExtractablePolicyFile,
  isPolicySection,
  parseBriefingScript,
} from "./policy-briefing-script";

const SAMPLE_POLICY = `
Silverleaf Academy Limited sets organisation rules for every staff member.

Ethical conduct is required in all dealings with families, learners, and partners. Violations can lead to discipline up to termination.

Every role starts with a written job offer and a signed contract. Verbal employment promises are not recognised.

Know your hours of work, attendance expectations, and health and safety duties. Reliable attendance protects learners and teammates.

Salary payments, benefits, leave, and travel reimbursement follow handbook rules rather than informal campus shortcuts.

Retirement, termination, and resignation have defined processes, including how benefits are treated when employment ends.

Confidentiality and harassment rules protect staff, families, and Silverleaf's reputation at all times.

Performance management and professional learning are part of your journey at work.

If any handbook rule is unclear, ask your manager or H R early rather than inventing an answer in front of families.
`.repeat(2);

describe("isPolicySection", () => {
  it("matches the policies section slug", () => {
    expect(isPolicySection("policies")).toBe(true);
    expect(isPolicySection("welcome")).toBe(false);
  });
});

describe("isExtractablePolicyFile", () => {
  it("accepts policy document types", () => {
    expect(isExtractablePolicyFile("handbook.pdf", "application/pdf")).toBe(true);
    expect(
      isExtractablePolicyFile(
        "policy.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(isExtractablePolicyFile("notes.txt", "text/plain")).toBe(true);
  });

  it("rejects media that cannot become a briefing", () => {
    expect(isExtractablePolicyFile("clip.mp4", "video/mp4")).toBe(false);
    expect(isExtractablePolicyFile("photo.png", "image/png")).toBe(false);
  });
});

describe("buildExtractiveBriefing", () => {
  it("builds intro, chapters, close, and next step from source sentences", () => {
    const script = buildExtractiveBriefing("Staff handbook", SAMPLE_POLICY);
    expect(script.title).toBe("Staff handbook");
    expect(script.chapters.length).toBeGreaterThanOrEqual(4);
    expect(script.intro).toContain("Staff handbook");
    expect(script.close.toLowerCase()).toContain("sign");
    expect(script.nextStep.toLowerCase()).toContain("sign");
    expect(script.chapters[0]?.body.length).toBeGreaterThan(20);
  });

  it("throws when there is not enough text", () => {
    expect(() => buildExtractiveBriefing("Empty", "Hi")).toThrow("NO_TEXT");
  });
});

describe("parseBriefingScript", () => {
  it("accepts a valid script", () => {
    const parsed = parseBriefingScript({
      title: "Uniform policy",
      intro: "This briefing covers the uniform policy for all staff on duty.",
      chapters: [
        { heading: "Who wears it", body: "Service roles wear the designated uniform whenever working." },
        { heading: "Badge", body: "Wear your official staff identification badge on school premises." },
        { heading: "Issuance", body: "New employees receive two uniforms and sign for them on receipt." },
        { heading: "Return", body: "Uniforms must be returned on termination or when requested." },
      ],
      close: "Open the full Uniform Policy next, then digitally sign this policy.",
      nextStep: "Open the Uniform Policy, then digitally sign this policy.",
    });
    expect(parsed?.title).toBe("Uniform policy");
  });

  it("rejects a script with too few chapters", () => {
    expect(
      parseBriefingScript({
        title: "X",
        intro: "Intro text that is long enough.",
        chapters: [{ heading: "A", body: "Body" }],
        close: "Close",
        nextStep: "Next",
      }),
    ).toBeNull();
  });
});
