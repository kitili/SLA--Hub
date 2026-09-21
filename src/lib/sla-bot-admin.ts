/**
 * Pure admin-bot helpers (how-to corpus + snapshot formatting).
 * Server I/O lives in sla-bot-admin-knowledge.ts and sla-bot-admin-snapshot.ts.
 */
import type { RiskLevel } from "@/lib/at-risk";

export type AdminKnowledgeChunk = {
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
};

export type AdminSnapshotMember = {
  fullName: string;
  email: string;
  campus: string | null;
  completionPct: number;
  complete: boolean;
  risk: RiskLevel;
};

export type AdminSnapshotAlert = {
  kind: string;
  summary: string;
  memberName: string | null;
};

export type AdminSnapshotCandidate = {
  fullName: string;
  roleApplied: string;
  stage: string;
};

/**
 * Static HR-portal how-to corpus. No member PII, hiring notes, tokens, or
 * quiz answer keys — those come from the live admin snapshot at ask time.
 */
export function buildAdminHowToChunks(): AdminKnowledgeChunk[] {
  return [
    {
      sourceType: "admin",
      sourceId: "overview",
      title: "HR portal overview",
      body: [
        "The admin area is at /admin and is only visible to HR admins.",
        "Use Members to monitor onboarding progress and at-risk staff.",
        "Use Sections, Quizzes, and Materials to edit published hub content.",
        "Use Campuses to assign people to a campus.",
        "Use Hiring for the candidate pipeline (culture video, performance task, interviews).",
        "Use SLA-bot alerts to resolve learner feedback, tech issues, and safeguarding alarms.",
        "Use Settings for app-level options such as the IT email.",
        "Learner SLA-bot cannot see this portal or other people's data.",
      ].join(" "),
    },
    {
      sourceType: "admin",
      sourceId: "members",
      title: "Members — progress monitoring",
      body: [
        "Open /admin/members for every staff row: completion %, checkpoints, last active, campus, job title.",
        "At-risk scoring is green / orange / red from expected ramp (42 days) vs actual completion, plus stale logins.",
        "Open a member to export their bio PDF or download qualification certificates.",
        "Completion uses published items plus published section quizzes.",
        "Ask HR-bot who is at risk, who has not started, or who has completed.",
      ].join(" "),
    },
    {
      sourceType: "admin",
      sourceId: "cms",
      title: "Sections, quizzes, and materials",
      body: [
        "Sections at /admin/sections: create, reorder, publish or unpublish. Unpublished sections are hidden from learners and from SLA-bot.",
        "Items live under a section (PDF, DOCX, video, YouTube, link).",
        "Quizzes at /admin/quizzes: one checkpoint per section. Do not read correct quiz options aloud in shared spaces.",
        "Materials at /admin/materials: upload files or attach YouTube. Policy PDF/DOCX can generate a briefing script to review before members see it.",
        "After CMS changes, SLA-bot knowledge refreshes automatically; you can also click Refresh knowledge on /admin/sla-bot.",
      ].join(" "),
    },
    {
      sourceType: "admin",
      sourceId: "hiring",
      title: "Hiring pipeline",
      body: [
        "The hiring board is /admin/hiring.",
        "Stages: Incomplete Application, New, Culture Video Requested/Submitted, Performance Task Requested/Submitted, Online Interview, In-Person Interview, Hired, Rejected.",
        "Add a candidate at /admin/hiring/candidates/new or import a CSV.",
        "Performance tasks are managed at /admin/hiring/performance-tasks.",
        "Public apply is /apply. Candidates upload work via token links — never paste those tokens into learner chat.",
        "Ask HR-bot how many candidates are in a stage, or who is waiting on culture / performance.",
      ].join(" "),
    },
    {
      sourceType: "admin",
      sourceId: "alerts",
      title: "SLA-bot alerts and knowledge",
      body: [
        "Learners talk to SLA-bot. Admins talk to HR-bot. Histories and knowledge indexes are separate.",
        "Open alerts at /admin/sla-bot: feedback, tech issues, and urgent safeguarding alarms.",
        "Tech issues email mourine@silverleaf.co.tz and it@silverleaf.co.tz.",
        "Mark an alert resolved when it is handled.",
        "Refresh knowledge rebuilds learner chunks from published content and admin how-to chunks.",
      ].join(" "),
    },
    {
      sourceType: "admin",
      sourceId: "campuses-settings",
      title: "Campuses and settings",
      body: [
        "Campuses at /admin/campuses: create campuses and assign members.",
        "Settings at /admin/settings: change operational emails such as IT.",
        "Admin access is the HR_ADMIN_EMAILS list plus the admin password at sign-in.",
      ].join(" "),
    },
  ];
}

export function formatAdminSnapshot(input: {
  members: AdminSnapshotMember[];
  alerts: AdminSnapshotAlert[];
  candidates: AdminSnapshotCandidate[];
}): string {
  const completed = input.members.filter((m) => m.complete).length;
  const atRisk = input.members.filter((m) => m.risk !== "green");
  const byRisk = { red: 0, orange: 0, green: 0 };
  for (const m of input.members) byRisk[m.risk] += 1;

  const stageCounts = new Map<string, number>();
  for (const c of input.candidates) {
    stageCounts.set(c.stage, (stageCounts.get(c.stage) ?? 0) + 1);
  }
  const stageLine =
    [...stageCounts.entries()]
      .map(([stage, n]) => `${stage}: ${n}`)
      .join("; ") || "none";

  const riskLines = atRisk
    .slice(0, 12)
    .map(
      (m) =>
        `- ${m.fullName || m.email} (${m.email}) ${m.completionPct}% ${m.risk}${m.campus ? ` · ${m.campus}` : ""}`,
    );

  const candidateLines = input.candidates
    .slice(0, 12)
    .map((c) => `- ${c.fullName} — ${c.roleApplied} (${c.stage})`);

  const alertLines = input.alerts
    .slice(0, 8)
    .map((a) => `- ${a.kind}: ${a.summary} (${a.memberName ?? "unknown"})`);

  return [
    `Members: ${input.members.length} registered, ${completed} completed, ${atRisk.length} at-risk (red ${byRisk.red}, orange ${byRisk.orange}, green ${byRisk.green}).`,
    riskLines.length > 0
      ? `At-risk members:\n${riskLines.join("\n")}`
      : "At-risk members: none.",
    `Open SLA-bot alerts: ${input.alerts.length}.`,
    alertLines.length > 0 ? alertLines.join("\n") : "",
    `Hiring: ${input.candidates.length} candidates. Stages: ${stageLine}.`,
    candidateLines.length > 0
      ? `Candidates:\n${candidateLines.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function focusSnapshotOnQuery(
  snapshot: string,
  query: string,
  members: AdminSnapshotMember[],
  candidates: AdminSnapshotCandidate[],
): string {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/i)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return snapshot;

  const matchedMembers = members.filter((m) => {
    const hay = `${m.fullName} ${m.email} ${m.campus ?? ""}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
  const matchedCandidates = candidates.filter((c) => {
    const hay = `${c.fullName} ${c.roleApplied} ${c.stage}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });

  if (matchedMembers.length === 0 && matchedCandidates.length === 0) {
    return snapshot;
  }

  const extra = [
    matchedMembers.length > 0
      ? `Matching members:\n${matchedMembers
          .slice(0, 8)
          .map(
            (m) =>
              `- ${m.fullName || m.email} ${m.email} ${m.completionPct}% ${m.risk}${m.complete ? " complete" : ""}`,
          )
          .join("\n")}`
      : "",
    matchedCandidates.length > 0
      ? `Matching candidates:\n${matchedCandidates
          .slice(0, 8)
          .map((c) => `- ${c.fullName} — ${c.roleApplied} (${c.stage})`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${snapshot}\n\n${extra}`;
}
