/**
 * Policy briefing repository: draft → publish leaves a single published row.
 */
import { describe, it, expect, beforeAll } from "vitest";

import { db } from "@/lib/db/client";
import { sections, sectionItems } from "@/lib/db/schema";
import {
  createGeneratingBriefing,
  markBriefingDraft,
  publishBriefing,
  getPublishedBriefingForItem,
} from "./policy-briefings";

const SECTION_ID = "test-briefing-section";
const ITEM_ID = "tb-1";

const SCRIPT = {
  title: "Test policy",
  intro: "This is a briefing intro for the test policy used in repository tests.",
  chapters: [
    { heading: "One", body: "First chapter body that is long enough for the schema." },
    { heading: "Two", body: "Second chapter body that is long enough for the schema." },
    { heading: "Three", body: "Third chapter body that is long enough for the schema." },
    { heading: "Four", body: "Fourth chapter body that is long enough for the schema." },
  ],
  close: "Open the full test policy next, then digitally sign this policy.",
  nextStep: "Open the full test policy, then digitally sign this policy.",
};

beforeAll(async () => {
  await db
    .insert(sections)
    .values({
      id: SECTION_ID,
      number: 98,
      order: 98,
      title_en: "Test briefing section",
    })
    .onConflictDoNothing();

  await db
    .insert(sectionItems)
    .values({
      id: ITEM_ID,
      sectionId: SECTION_ID,
      order: 1,
      type: "pdf",
      title_en: "Test policy",
    })
    .onConflictDoNothing();
});

describe("policy briefings repository", () => {
  it("publishes a draft and unpublishes the previous one", async () => {
    const first = await createGeneratingBriefing({
      sectionItemId: ITEM_ID,
      sourceMaterialId: null,
      sourceFilename: "a.pdf",
      createdBy: null,
    });
    await markBriefingDraft({
      id: first.id,
      script: SCRIPT,
      sourceHash: "aaa",
      generator: "extractive",
    });
    await publishBriefing(first.id);

    const second = await createGeneratingBriefing({
      sectionItemId: ITEM_ID,
      sourceMaterialId: null,
      sourceFilename: "b.pdf",
      createdBy: null,
    });
    await markBriefingDraft({
      id: second.id,
      script: { ...SCRIPT, title: "Updated policy" },
      sourceHash: "bbb",
      generator: "extractive",
    });
    await publishBriefing(second.id);

    const published = await getPublishedBriefingForItem(ITEM_ID);
    expect(published?.id).toBe(second.id);
    expect(published?.scriptEn.title).toBe("Updated policy");
    expect(published?.status).toBe("published");
  });
});
