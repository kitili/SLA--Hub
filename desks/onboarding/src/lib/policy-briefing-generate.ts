import "server-only";

import { env } from "@/lib/env";
import {
  buildExtractiveBriefing,
  parseBriefingScript,
  type PolicyBriefingScript,
} from "@/lib/policy-briefing-script";

const MAX_SOURCE_CHARS = 24_000;

function briefingSystemPrompt(): string {
  return [
    "You write 3-minute staff onboarding briefings for Silverleaf Academy policies.",
    "Use ONLY facts present in the source policy text. Do not invent rules, names, dates, or penalties.",
    "The full PDF remains the official policy; this is a briefing, not a replacement.",
    "Write spoken English suitable for text-to-speech: short sentences, spell out acronyms with spaces (H R, I C T, N D A).",
    "Target about 420 to 450 spoken words across intro + chapters + close.",
    "Return JSON only matching this shape:",
    '{ "title": string, "intro": string, "chapters": [{ "heading": string, "body": string }], "close": string, "nextStep": string }',
    "Use 8 to 12 chapters. nextStep should tell the staff member to open the full policy and digitally sign it.",
  ].join(" ");
}

async function generateWithOpenAi(
  title: string,
  sourceText: string,
): Promise<PolicyBriefingScript | null> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const clipped = sourceText.slice(0, MAX_SOURCE_CHARS);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: briefingSystemPrompt() },
        {
          role: "user",
          content:
            `Policy title: ${title}\n\nOfficial policy text:\n${clipped}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OPENAI_${res.status}:${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return null;
  }
  return parseBriefingScript(parsed);
}

export async function generateBriefingScript(
  title: string,
  sourceText: string,
): Promise<{ script: PolicyBriefingScript; generator: "openai" | "extractive" }> {
  const trimmed = sourceText.replace(/\s+/g, " ").trim();
  if (trimmed.length < 80) {
    throw new Error("NO_TEXT");
  }

  try {
    const llm = await generateWithOpenAi(title, sourceText);
    if (llm) return { script: llm, generator: "openai" };
  } catch (err) {
    console.error("[policy-briefing] OpenAI generate failed", err);
  }

  return {
    script: buildExtractiveBriefing(title, sourceText),
    generator: "extractive",
  };
}
