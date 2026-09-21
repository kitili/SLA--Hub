"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { slaBotRepo } from "@/lib/db/repositories";
import { handleAdminSlaBotMessage } from "@/lib/sla-bot-admin-engine";
import { syncSlaBotAdminKnowledge } from "@/lib/sla-bot-admin-knowledge";
import { handleSlaBotMessage } from "@/lib/sla-bot-engine";
import { syncSlaBotKnowledge } from "@/lib/sla-bot-knowledge";
import type { Locale } from "@/i18n/routing";

const messageSchema = z.string().trim().min(1).max(4000);

export async function getSlaBotHistoryAction(): Promise<{
  ok: boolean;
  messages?: { role: string; content: string; createdAtISO: string }[];
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const conversation = await slaBotRepo.getOrCreateConversation(
    user.id,
    "learner",
  );
  const rows = await slaBotRepo.listRecentMessages(conversation.id, 40);
  return {
    ok: true,
    messages: rows.map((m) => ({
      role: m.role,
      content: m.content,
      createdAtISO: m.createdAt.toISOString(),
    })),
  };
}

export async function sendSlaBotMessageAction(input: {
  message: string;
  locale: string;
}): Promise<{
  ok: boolean;
  error?: string;
  reply?: string;
  intent?: string;
  alertCreated?: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const parsed = messageSchema.safeParse(input.message);
  if (!parsed.success) return { ok: false, error: "empty" };

  const locale = (input.locale === "sw" ? "sw" : "en") as Locale;
  try {
    const result = await handleSlaBotMessage({
      user,
      message: parsed.data,
      locale,
    });
    return {
      ok: true,
      reply: result.reply,
      intent: result.intent,
      alertCreated: result.alertCreated,
    };
  } catch (err) {
    console.error("[sla-bot] send failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function getAdminSlaBotHistoryAction(): Promise<{
  ok: boolean;
  messages?: { role: string; content: string; createdAtISO: string }[];
}> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { ok: false };

  const conversation = await slaBotRepo.getOrCreateConversation(
    user.id,
    "admin",
  );
  const rows = await slaBotRepo.listRecentMessages(conversation.id, 40);
  return {
    ok: true,
    messages: rows.map((m) => ({
      role: m.role,
      content: m.content,
      createdAtISO: m.createdAt.toISOString(),
    })),
  };
}

export async function sendAdminSlaBotMessageAction(input: {
  message: string;
}): Promise<{
  ok: boolean;
  error?: string;
  reply?: string;
  intent?: string;
}> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { ok: false, error: "forbidden" };

  const parsed = messageSchema.safeParse(input.message);
  if (!parsed.success) return { ok: false, error: "empty" };

  try {
    const result = await handleAdminSlaBotMessage({
      user,
      message: parsed.data,
    });
    return { ok: true, reply: result.reply, intent: result.intent };
  } catch (err) {
    console.error("[hr-bot] send failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function resolveSlaBotAlertAction(
  alertId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (typeof alertId !== "string" || alertId.length === 0) {
    return { ok: false, error: "invalid" };
  }
  const row = await slaBotRepo.resolveAlert(alertId);
  if (!row) return { ok: false, error: "not-found" };
  revalidatePath("/admin/sla-bot");
  return { ok: true };
}

export async function refreshSlaBotKnowledgeAction(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  await requireAdmin();
  try {
    const learnerCount = await syncSlaBotKnowledge();
    const adminCount = await syncSlaBotAdminKnowledge();
    revalidatePath("/admin/sla-bot");
    return { ok: true, count: learnerCount + adminCount };
  } catch (err) {
    console.error("[sla-bot] refresh knowledge failed", err);
    return { ok: false, error: "failed" };
  }
}
