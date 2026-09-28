import "server-only";

import { env } from "@/lib/env";
import { slaBotRepo } from "@/lib/db/repositories";
import { syncSlaBotAdminKnowledge } from "@/lib/sla-bot-admin-knowledge";
import { loadAdminSnapshot } from "@/lib/sla-bot-admin-snapshot";
import {
  adminHelpText,
  buildAdminExtractiveAnswer,
  classifySlaBotIntent,
  type SlaBotIntent,
} from "@/lib/sla-bot";
import type { CurrentUser } from "@/lib/contracts";

export interface AdminSlaBotReply {
  reply: string;
  intent: SlaBotIntent;
}

async function ensureAdminKnowledge(): Promise<void> {
  const count = await slaBotRepo.knowledgeCount("admin");
  if (count === 0) {
    await syncSlaBotAdminKnowledge();
  }
}

async function answerWithOpenAi(input: {
  question: string;
  context: string;
  snapshot: string;
  adminName: string | null;
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
            "You are HR-bot, the admin assistant for the Silverleaf Academy Onboarding Hub.",
            "Answer only from the HR portal how-to context and the live admin snapshot.",
            "Be concise and practical. Name the admin page to open when relevant.",
            "Never invent policy rules, quiz answers, or hiring decisions.",
            "Never include passwords, tokens, CV links, bank details, or certificate contents.",
            "This chat is admin-only. Do not suggest sharing member or candidate data with learners.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Admin: ${input.adminName ?? "HR admin"}`,
            "Live snapshot:",
            input.snapshot,
            "HR portal context:",
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

export async function handleAdminSlaBotMessage(input: {
  user: CurrentUser;
  message: string;
}): Promise<AdminSlaBotReply> {
  const text = input.message.trim().slice(0, 4000);
  if (!text) {
    return { reply: adminHelpText(), intent: "help" };
  }

  await ensureAdminKnowledge();
  const conversation = await slaBotRepo.getOrCreateConversation(
    input.user.id,
    "admin",
  );
  const intent = classifySlaBotIntent(text);
  await slaBotRepo.appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: text,
    intent,
  });

  const snapshot = await loadAdminSnapshot(text);
  let reply = "";

  if (intent === "greeting") {
    reply = `Hello${input.user.fullName ? ` ${input.user.fullName.split(" ")[0]}` : ""} — I am HR-bot. ${adminHelpText()}\n\n${snapshot}`;
  } else if (intent === "help") {
    reply = `${adminHelpText()}\n\n${snapshot}`;
  } else {
    const chunks = await slaBotRepo.searchKnowledge(text, 8, "admin");
    const context = chunks
      .map((c) => `### ${c.title}\n${c.body.slice(0, 1200)}`)
      .join("\n\n");
    const llm = await answerWithOpenAi({
      question: text,
      context,
      snapshot,
      adminName: input.user.fullName,
    });
    reply =
      llm ??
      buildAdminExtractiveAnswer(
        text,
        chunks.map((c) => ({ title: c.title, body: c.body })),
        snapshot,
      );
  }

  await slaBotRepo.appendMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: reply,
    intent,
  });

  return { reply, intent };
}
