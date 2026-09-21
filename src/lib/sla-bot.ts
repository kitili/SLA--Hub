/**
 * Pure helpers for SLA-bot intent routing and extractive answers.
 */
export type SlaBotAudience = "learner" | "admin";

export type SlaBotIntent =
  | "question"
  | "feedback"
  | "tech_issue"
  | "alarm"
  | "greeting"
  | "help";

const TECH_RE =
  /\b(bug|broken|error|crash|cannot (log|sign)|can't (log|sign)|login|password|otp|email (code|otp)|not loading|blank page|404|500|tech(nical)? issue|it support|wifi|browser)\b/i;

const FEEDBACK_RE =
  /\b(feedback|suggestion|improve|unclear|confusing|expect(ed|ations)?|reflection|comment for hr)\b/i;

const ALARM_RE =
  /\b(urgent|emergency|danger|abuse|harassment|safeguarding|child (at )?risk|violence|threat|immediate help|alarm)\b/i;

const GREETING_RE = /^(hi|hello|hey|habari|mambo|good (morning|afternoon|evening))\b/i;

const HELP_RE =
  /\b(what can you (do|help with)|how can you help|help me with (this|onboarding)|your commands|what do you do)\b/i;

export function classifySlaBotIntent(message: string): SlaBotIntent {
  const text = message.trim();
  if (!text) return "help";
  if (ALARM_RE.test(text)) return "alarm";
  if (TECH_RE.test(text)) return "tech_issue";
  if (FEEDBACK_RE.test(text)) return "feedback";
  if (GREETING_RE.test(text) && text.split(/\s+/).length <= 6) return "greeting";
  if (HELP_RE.test(text)) return "help";
  return "question";
}

export function buildExtractiveAnswer(
  question: string,
  chunks: { title: string; body: string }[],
  progressLine: string,
): string {
  if (chunks.length === 0) {
    return (
      "I do not have indexed hub content yet. Ask HR to refresh SLA-bot knowledge, " +
      "or open your dashboard sections and try again. " +
      progressLine
    );
  }

  const top = chunks.slice(0, 3);
  const lines = [
    "Here is what I found in the current Onboarding Hub content:",
    ...top.map((c, i) => `${i + 1}. ${c.title} — ${c.body.slice(0, 320).trim()}…`),
    progressLine,
    "If this does not answer you, rephrase the question or ask me to escalate feedback / a tech issue.",
  ];
  void question;
  return lines.join("\n\n");
}

export function helpText(): string {
  return [
    "I am SLA-bot — your Silverleaf onboarding helper.",
    "Ask about sections, policies, signatures, quizzes, or what to do next.",
    "Say “feedback: …” to send feedback to HR.",
    "Describe a tech problem (login, page error, OTP) and I can email IT / Mourine.",
    "For urgent safeguarding or safety issues, say so clearly — I will alert HR admins immediately.",
    "I cannot see other staff, the hiring pipeline, or the HR admin portal.",
  ].join(" ");
}

export function adminHelpText(): string {
  return [
    "I am HR-bot — the admin assistant for the Silverleaf Onboarding Hub.",
    "Ask how to monitor members, edit sections or quizzes, upload materials, run hiring, or handle SLA-bot alerts.",
    "I can summarise live member progress, at-risk staff, open alerts, and hiring stages.",
    "I never share this admin data with the learner SLA-bot.",
    "Do not paste secrets or passwords into chat.",
  ].join(" ");
}

export function buildAdminExtractiveAnswer(
  question: string,
  chunks: { title: string; body: string }[],
  snapshotLine: string,
): string {
  if (chunks.length === 0) {
    return [
      "I do not have indexed admin how-to content yet. Refresh SLA-bot knowledge from /admin/sla-bot.",
      snapshotLine,
    ].join("\n\n");
  }

  const top = chunks.slice(0, 3);
  const lines = [
    "Here is what I found in the HR portal guide and live snapshot:",
    ...top.map((c, i) => `${i + 1}. ${c.title} — ${c.body.slice(0, 320).trim()}…`),
    snapshotLine,
    "If this does not answer you, name the page (Members, Sections, Hiring) or the person you mean.",
  ];
  void question;
  return lines.join("\n\n");
}

/** Keyword rank used by both bots so learner/admin search stay testable. */
export function rankKnowledgeChunks<T extends { title: string; body: string }>(
  query: string,
  chunks: T[],
  limit = 8,
): T[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 8);
  if (terms.length === 0) return chunks.slice(0, limit);

  const scored = chunks
    .map((chunk) => {
      const hay = `${chunk.title}\n${chunk.body}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (hay.includes(term)) score += term.length;
      }
      return { chunk, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.chunk);

  if (scored.length > 0) return scored;
  return chunks.slice(0, Math.min(limit, chunks.length));
}

/** Phrases that must never appear in learner-facing help or answers. */
const LEARNER_FORBIDDEN = [
  /hiring candidate/i,
  /at-risk members?/i,
  /culture video feedback/i,
  /performance task link/i,
  /it onboarding token/i,
  /admin password/i,
  /quiz answer key/i,
];

export function leaksAdminOnlyContent(text: string): boolean {
  return LEARNER_FORBIDDEN.some((re) => re.test(text));
}
