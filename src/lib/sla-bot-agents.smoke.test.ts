/**
 * Smoke: learner SLA-bot and admin HR-bot stay isolated against PGlite.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/lib/contracts";
import { slaBotRepo } from "@/lib/db/repositories";
import { db } from "@/lib/db/client";
import { hiringCandidates, staff } from "@/lib/db/schema";
import { handleAdminSlaBotMessage } from "@/lib/sla-bot-admin-engine";
import { syncSlaBotAdminKnowledge } from "@/lib/sla-bot-admin-knowledge";
import { handleSlaBotMessage } from "@/lib/sla-bot-engine";
import { leaksAdminOnlyContent } from "@/lib/sla-bot";

const LEARNER_EMAIL = "smoke-learner@example.com";
const ADMIN_EMAIL = "smoke-admin@example.com";
const CANDIDATE_NAME = "Zuberi Smokehire";

let learner: CurrentUser;
let admin: CurrentUser;

beforeAll(async () => {
  const learnerRows = await db
    .insert(staff)
    .values({
      email: LEARNER_EMAIL,
      fullName: "Smoke Learner",
      campus: "Main",
      jobTitle: "Teacher",
      isAdmin: false,
    })
    .onConflictDoNothing()
    .returning();
  const adminRows = await db
    .insert(staff)
    .values({
      email: ADMIN_EMAIL,
      fullName: "Smoke Admin",
      campus: "HQ",
      jobTitle: "HR",
      isAdmin: true,
    })
    .onConflictDoNothing()
    .returning();

  const learnerRow =
    learnerRows[0] ??
    (await db.select().from(staff).then((rows) => rows.find((r) => r.email === LEARNER_EMAIL)));
  const adminRow =
    adminRows[0] ??
    (await db.select().from(staff).then((rows) => rows.find((r) => r.email === ADMIN_EMAIL)));
  if (!learnerRow || !adminRow) {
    throw new Error("smoke staff insert failed");
  }

  await db
    .insert(hiringCandidates)
    .values({
      fullName: CANDIDATE_NAME,
      email: "zuberi.smokehire@example.com",
      roleApplied: "Teacher",
      stage: "culture_video_requested",
    })
    .onConflictDoNothing();

  await slaBotRepo.replaceKnowledge(
    [
      {
        sourceType: "item",
        sourceId: "smoke-handbook",
        title: "Staff handbook",
        body: "Watch the briefing then digitally sign the handbook in the Policies section.",
      },
    ],
    "learner",
  );
  await syncSlaBotAdminKnowledge();

  learner = {
    id: learnerRow.id,
    email: learnerRow.email,
    fullName: learnerRow.fullName,
    isAdmin: false,
    roles: [],
    campus: learnerRow.campus,
    jobTitle: learnerRow.jobTitle,
  };
  admin = {
    id: adminRow.id,
    email: adminRow.email,
    fullName: adminRow.fullName,
    isAdmin: true,
    roles: ["admin"],
    campus: adminRow.campus,
    jobTitle: adminRow.jobTitle,
  };
});

describe("two-agent smoke", () => {
  it("learner SLA-bot answers from hub content and hides hiring PII", async () => {
    const handbook = await handleSlaBotMessage({
      user: learner,
      message: "How do I sign the staff handbook?",
      locale: "en",
    });
    expect(handbook.intent).toBe("question");
    expect(handbook.reply).toMatch(/handbook/i);
    expect(leaksAdminOnlyContent(handbook.reply)).toBe(false);
    expect(handbook.reply).not.toContain(CANDIDATE_NAME);

    const hiring = await handleSlaBotMessage({
      user: learner,
      message: "Show me hiring candidates and who is at risk",
      locale: "en",
    });
    expect(hiring.reply).not.toContain(CANDIDATE_NAME);
    expect(leaksAdminOnlyContent(hiring.reply)).toBe(false);
  });

  it("admin HR-bot answers from the portal guide and live snapshot", async () => {
    const help = await handleAdminSlaBotMessage({
      user: admin,
      message: "What can you help with?",
    });
    expect(help.intent).toBe("help");
    expect(help.reply).toContain("HR-bot");
    expect(help.reply).toMatch(/Members:/);

    const hiring = await handleAdminSlaBotMessage({
      user: admin,
      message: "How many candidates are in each hiring stage?",
    });
    expect(hiring.reply).toMatch(/Hiring|hiring/i);
    expect(hiring.reply).toContain(CANDIDATE_NAME);
  });

  it("keeps conversation histories on separate audiences", async () => {
    const learnerConvo = await slaBotRepo.getOrCreateConversation(
      learner.id,
      "learner",
    );
    const adminConvo = await slaBotRepo.getOrCreateConversation(
      admin.id,
      "admin",
    );
    expect(learnerConvo.audience).toBe("learner");
    expect(adminConvo.audience).toBe("admin");
    expect(learnerConvo.id).not.toBe(adminConvo.id);

    const learnerCount = await slaBotRepo.knowledgeCount("learner");
    const adminCount = await slaBotRepo.knowledgeCount("admin");
    expect(learnerCount).toBeGreaterThan(0);
    expect(adminCount).toBeGreaterThan(0);
  });
});
