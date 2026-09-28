import { describe, expect, it } from "vitest";

import {
  buildAdminHowToChunks,
  focusSnapshotOnQuery,
  formatAdminSnapshot,
} from "./sla-bot-admin";
import {
  adminHelpText,
  buildAdminExtractiveAnswer,
  buildExtractiveAnswer,
  classifySlaBotIntent,
  helpText,
  leaksAdminOnlyContent,
  rankKnowledgeChunks,
} from "./sla-bot";

describe("classifySlaBotIntent", () => {
  it("detects tech issues", () => {
    expect(classifySlaBotIntent("I cannot login and the OTP email never arrives")).toBe(
      "tech_issue",
    );
  });

  it("detects feedback", () => {
    expect(classifySlaBotIntent("Feedback: the policies section was confusing")).toBe(
      "feedback",
    );
  });

  it("detects alarms", () => {
    expect(
      classifySlaBotIntent("Urgent safeguarding concern about a child at risk"),
    ).toBe("alarm");
  });

  it("defaults to question", () => {
    expect(classifySlaBotIntent("How do I sign the staff handbook?")).toBe(
      "question",
    );
  });
});

describe("buildExtractiveAnswer", () => {
  it("includes matching chunk titles", () => {
    const answer = buildExtractiveAnswer(
      "handbook",
      [
        {
          title: "Staff handbook",
          body: "Watch the briefing then digitally sign the handbook.",
        },
      ],
      "Progress: 10%.",
    );
    expect(answer).toContain("Staff handbook");
    expect(answer).toContain("Progress: 10%");
  });
});

describe("helpText", () => {
  it("names SLA-bot", () => {
    expect(helpText()).toContain("SLA-bot");
  });

  it("does not leak admin-only topics to learners", () => {
    expect(leaksAdminOnlyContent(helpText())).toBe(false);
  });
});

describe("adminHelpText", () => {
  it("names HR-bot and the admin portal", () => {
    expect(adminHelpText()).toContain("HR-bot");
    expect(adminHelpText()).toMatch(/members|hiring|SLA-bot alerts/i);
  });
});

describe("rankKnowledgeChunks isolation", () => {
  const learnerChunks = [
    {
      audience: "learner" as const,
      title: "Policies & Compliance",
      body: "Read the staff handbook then digitally sign.",
    },
  ];
  const adminChunks = [
    {
      audience: "admin" as const,
      title: "Hiring pipeline",
      body: "Move a hiring candidate through culture video stages.",
    },
  ];

  it("never mixes admin chunks into a learner-only corpus", () => {
    const hits = rankKnowledgeChunks("hiring candidate", learnerChunks, 8);
    expect(hits.every((h) => h.audience === "learner")).toBe(true);
    expect(hits.some((h) => /hiring candidate/i.test(`${h.title} ${h.body}`))).toBe(
      false,
    );
  });

  it("returns admin how-to when ranking admin knowledge", () => {
    const hits = rankKnowledgeChunks("hiring candidate", adminChunks, 8);
    expect(hits[0]?.title).toBe("Hiring pipeline");
  });
});

describe("buildAdminHowToChunks", () => {
  it("covers members, hiring, and alerts without tokens or quiz keys", () => {
    const chunks = buildAdminHowToChunks();
    const blob = chunks.map((c) => `${c.title} ${c.body}`).join("\n");
    expect(chunks.every((c) => c.sourceType === "admin")).toBe(true);
    expect(blob).toMatch(/\/admin\/members/);
    expect(blob).toMatch(/\/admin\/hiring/);
    expect(blob).not.toMatch(/it onboarding token/i);
    expect(blob).not.toMatch(/quiz answer key/i);
  });
});

describe("formatAdminSnapshot", () => {
  it("lists at-risk members and hiring stages", () => {
    const text = formatAdminSnapshot({
      members: [
        {
          fullName: "Asha Mwanga",
          email: "asha@silverleaf.co.tz",
          campus: "Arusha",
          completionPct: 20,
          complete: false,
          risk: "red",
        },
      ],
      alerts: [
        {
          kind: "tech_issue",
          summary: "OTP missing",
          memberName: "Asha Mwanga",
        },
      ],
      candidates: [
        {
          fullName: "Juma Ali",
          roleApplied: "Teacher",
          stage: "Culture Video Requested",
        },
      ],
    });
    expect(text).toContain("Asha Mwanga");
    expect(text).toContain("Juma Ali");
    expect(text).toContain("at-risk");
    expect(text).toContain("Culture Video Requested");
  });
});

describe("focusSnapshotOnQuery", () => {
  it("adds a matching member block", () => {
    const focused = focusSnapshotOnQuery(
      "Members: 1",
      "How is Asha doing?",
      [
        {
          fullName: "Asha Mwanga",
          email: "asha@silverleaf.co.tz",
          campus: "Arusha",
          completionPct: 20,
          complete: false,
          risk: "red",
        },
      ],
      [],
    );
    expect(focused).toContain("Matching members");
    expect(focused).toContain("Asha Mwanga");
  });
});

describe("buildAdminExtractiveAnswer", () => {
  it("includes how-to titles and the live snapshot", () => {
    const answer = buildAdminExtractiveAnswer(
      "hiring",
      [{ title: "Hiring pipeline", body: "Open /admin/hiring." }],
      "Hiring: 3 candidates.",
    );
    expect(answer).toContain("Hiring pipeline");
    expect(answer).toContain("Hiring: 3 candidates.");
  });
});
