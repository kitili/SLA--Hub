import "server-only";

import { env, getHrAdminEmails } from "@/lib/env";
import { sendHubEmail, SLA_BOT_TECH_EMAILS } from "@/lib/hub-mail";
import { getMemberDashboard } from "@/lib/dashboard";
import { slaBotRepo } from "@/lib/db/repositories";
import { syncSlaBotKnowledge } from "@/lib/sla-bot-knowledge";
import {
  buildExtractiveAnswer,
  classifySlaBotIntent,
  helpText,
  type SlaBotIntent,
} from "@/lib/sla-bot";
import type { CurrentUser } from "@/lib/contracts";
import type { Locale } from "@/i18n/routing";

export interface SlaBotReply {
  reply: string;
  intent: SlaBotIntent;
  alertCreated: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function ensureKnowledge(): Promise<void> {
  const count = await slaBotRepo.knowledgeCount("learner");
  if (count === 0) {
    await syncSlaBotKnowledge();
  }
}

async function answerWithOpenAi(input: {
  question: string;
  context: string;
  progressLine: string;
  memberName: string | null;
}): Promise<string | null> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are SLA-bot for the Silverleaf Academy Staff Onboarding Hub.",
            "Answer only from the provided hub context and the learner progress line.",
            "Be concise, practical, and friendly. If unsure, say so and suggest the right section or asking HR.",
            "Never invent policy rules. For child protection emergencies, tell the user to follow safeguarding contacts immediately.",
            "Do not claim you sent email unless the user message is being escalated by the system separately.",
            "You cannot see other staff, hiring candidates, quiz answer keys, or the HR admin portal. If asked, say only HR admins can see that.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Learner: ${input.memberName ?? "staff member"}`,
            input.progressLine,
            "Hub context:",
            input.context,
            "Question:",
            input.question,
          ].join("\n\n"),
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function escalate(input: {
  user: CurrentUser;
  conversationId: string;
  kind: "feedback" | "tech_issue" | "alarm";
  severity: "info" | "warning" | "critical";
  message: string;
  recipients: string[];
}): Promise<boolean> {
  const subject =
    input.kind === "alarm"
      ? `[SLA-bot ALARM] ${input.user.fullName ?? input.user.email}`
      : input.kind === "tech_issue"
        ? `[SLA-bot tech] ${input.user.fullName ?? input.user.email}`
        : `[SLA-bot feedback] ${input.user.fullName ?? input.user.email}`;

  const html = `
    <p><strong>SLA-bot ${escapeHtml(input.kind)}</strong></p>
    <p>From: ${escapeHtml(input.user.fullName ?? "—")} &lt;${escapeHtml(input.user.email)}&gt;</p>
    <p>Campus: ${escapeHtml(input.user.campus ?? "unassigned")}</p>
    <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.message)}</pre>
  `;

  const mail = await sendHubEmail({
    to: input.recipients,
    subject,
    htmlBody: html,
    replyTo: input.user.email,
  });

  await slaBotRepo.createAlert({
    memberId: input.user.id,
    conversationId: input.conversationId,
    kind: input.kind,
    severity: input.severity,
    summary: input.message.slice(0, 180),
    detail: input.message,
    emailTo: input.recipients.join(", "),
    emailSent: mail.ok,
  });

  return mail.ok;
}

export async function handleSlaBotMessage(input: {
  user: CurrentUser;
  message: string;
  locale: Locale;
}): Promise<SlaBotReply> {
  const text = input.message.trim().slice(0, 4000);
  if (!text) {
    return { reply: helpText(), intent: "help", alertCreated: false };
  }

  await ensureKnowledge();
  const conversation = await slaBotRepo.getOrCreateConversation(
    input.user.id,
    "learner",
  );
  const intent = classifySlaBotIntent(text);
  await slaBotRepo.appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: text,
    intent,
  });

  const dashboard = await getMemberDashboard(
    { id: input.user.id, fullName: input.user.fullName },
    input.locale,
  );
  const progressLine = `Progress: ${dashboard.overallPct}% complete (${dashboard.stepsDone}/${dashboard.totalSteps} steps). Next: ${dashboard.nextStep.kind}${dashboard.nextStep.sectionTitle ? ` — ${dashboard.nextStep.sectionTitle}` : ""}.`;

  let reply = "";
  let alertCreated = false;

  if (intent === "greeting") {
    reply = `Hello${input.user.fullName ? ` ${input.user.fullName.split(" ")[0]}` : ""} — I am SLA-bot. ${helpText()} ${progressLine}`;
  } else if (intent === "help") {
    reply = `${helpText()}\n\n${progressLine}`;
  } else if (intent === "feedback") {
    const admins = getHrAdminEmails();
    const recipients =
      admins.length > 0
        ? admins
        : [process.env.ALERT_EMAIL || "hr@silverleaf.co.tz"];
    await escalate({
      user: input.user,
      conversationId: conversation.id,
      kind: "feedback",
      severity: "info",
      message: text,
      recipients,
    });
    alertCreated = true;
    reply =
      "Thank you — I recorded your feedback and notified HR admins. You can also use the Feedback page on the dashboard for the longer reflection form.";
  } else if (intent === "tech_issue") {
    await escalate({
      user: input.user,
      conversationId: conversation.id,
      kind: "tech_issue",
      severity: "warning",
      message: text,
      recipients: [...SLA_BOT_TECH_EMAILS],
    });
    alertCreated = true;
    reply =
      "I logged this as a tech issue and emailed mourine@silverleaf.co.tz and it@silverleaf.co.tz with your details. Include screenshots or the exact page URL if you can reply to that email thread.";
  } else if (intent === "alarm") {
    const admins = getHrAdminEmails();
    const recipients = [
      ...new Set([
        ...admins,
        process.env.ALERT_EMAIL || "hr@silverleaf.co.tz",
        ...SLA_BOT_TECH_EMAILS,
      ]),
    ];
    await escalate({
      user: input.user,
      conversationId: conversation.id,
      kind: "alarm",
      severity: "critical",
      message: text,
      recipients,
    });
    alertCreated = true;
    reply =
      "I treated this as urgent and alerted HR admins (and IT contacts). If a child or person is in immediate danger, contact your campus lead / Child Protection contacts now — do not wait for email.";
  } else {
    const chunks = await slaBotRepo.searchKnowledge(text, 8, "learner");
    const context = chunks
      .map((c) => `### ${c.title}\n${c.body.slice(0, 1200)}`)
      .join("\n\n");
    const llm = await answerWithOpenAi({
      question: text,
      context,
      progressLine,
      memberName: input.user.fullName,
    });
    reply =
      llm ??
      buildExtractiveAnswer(
        text,
        chunks.map((c) => ({ title: c.title, body: c.body })),
        progressLine,
      );
  }

  await slaBotRepo.appendMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: reply,
    intent,
  });

  return { reply, intent, alertCreated };
}
