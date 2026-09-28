/**
 * Integration: generate a draft briefing from policy text, then publish.
 */
import { describe, it, expect, beforeAll } from "vitest";

import { db } from "@/lib/db/client";
import { sections, sectionItems } from "@/lib/db/schema";
import {
  createGeneratingBriefing,
  getPublishedBriefingForItem,
  markBriefingDraft,
  publishBriefing,
} from "./policy-briefings";
import { extractPolicyDocumentText } from "@/lib/policy-briefing-extract";
import { generateBriefingScript } from "@/lib/policy-briefing-generate";

const ITEM_ID = "tb-pipeline-1";
const POLICY_TEXT = `
Silverleaf Academy Limited sets organisation rules, office policies, and employment information for every staff member on every campus.

Ethical conduct is required in all dealings with families, learners, and partners. Violations can lead to discipline up to termination of employment.

Every role starts with a written job offer and a signed contract. Verbal employment promises are not recognised by the academy.

Know your hours of work, attendance expectations, and health and safety duties. Reliable attendance protects learners and teammates.

Salary payments, benefits, leave, and travel reimbursement follow handbook rules rather than informal campus shortcuts.

Retirement, termination, and resignation have defined processes, including how benefits are treated when employment ends.

Confidentiality and harassment rules protect staff, families, and Silverleaf's reputation at all times on and off campus.

Performance management and professional learning are part of your journey at work and should be used to improve, not only when something goes wrong.
`.repeat(2);

beforeAll(async () => {
  await db
    .insert(sections)
    .values({
      id: "policies",
      number: 2,
      order: 2,
      title_en: "Policies & Compliance",
    })
    .onConflictDoNothing();

  await db
    .insert(sectionItems)
    .values({
      id: ITEM_ID,
      sectionId: "policies",
      order: 90,
      type: "pdf",
      title_en: "Pipeline test policy",
    })
    .onConflictDoNothing();
});

describe("policy briefing generate pipeline", () => {
  it("extracts text, writes a draft script, and publishes it", async () => {
    const bytes = Buffer.from(POLICY_TEXT, "utf8");

    const text = await extractPolicyDocumentText({
      bytes,
      filename: "policy.txt",
      contentType: "text/plain",
    });
    expect(text.length).toBeGreaterThan(80);

    const { script, generator } = await generateBriefingScript(
      "Pipeline test policy",
      text,
    );
    expect(["extractive", "openai"]).toContain(generator);
    expect(script.chapters.length).toBeGreaterThanOrEqual(4);

    const row = await createGeneratingBriefing({
      sectionItemId: ITEM_ID,
      sourceMaterialId: null,
      sourceFilename: "policy.txt",
      createdBy: null,
    });
    await markBriefingDraft({
      id: row.id,
      script,
      sourceHash: "test-hash",
      generator,
    });
    const published = await publishBriefing(row.id);
    expect(published?.status).toBe("published");

    const loaded = await getPublishedBriefingForItem(ITEM_ID);
    expect(loaded?.id).toBe(row.id);
    expect(loaded?.scriptEn.chapters.length).toBeGreaterThanOrEqual(4);
  });
});
