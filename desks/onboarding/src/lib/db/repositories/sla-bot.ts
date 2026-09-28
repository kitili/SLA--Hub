import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { rankKnowledgeChunks, type SlaBotAudience } from "@/lib/sla-bot";

import { db } from "../client";
import {
  slaBotAlerts,
  slaBotConversations,
  slaBotKnowledge,
  slaBotMessages,
  type SlaBotAlert,
  type SlaBotConversation,
  type SlaBotKnowledgeChunk,
  type SlaBotMessage,
} from "../schema/sla-bot";
import { staff } from "../schema/staff";

export async function getOrCreateConversation(
  memberId: string,
  audience: SlaBotAudience = "learner",
): Promise<SlaBotConversation> {
  const existing = await db
    .select()
    .from(slaBotConversations)
    .where(
      and(
        eq(slaBotConversations.memberId, memberId),
        eq(slaBotConversations.audience, audience),
      ),
    )
    .orderBy(desc(slaBotConversations.updatedAt))
    .limit(1);
  if (existing[0]) return existing[0];

  const rows = await db
    .insert(slaBotConversations)
    .values({ memberId, audience })
    .returning();
  return rows[0]!;
}

export async function listRecentMessages(
  conversationId: string,
  limit = 40,
): Promise<SlaBotMessage[]> {
  const rows = await db
    .select()
    .from(slaBotMessages)
    .where(eq(slaBotMessages.conversationId, conversationId))
    .orderBy(desc(slaBotMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function appendMessage(input: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string | null;
}): Promise<SlaBotMessage> {
  const rows = await db
    .insert(slaBotMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
    })
    .returning();
  await db
    .update(slaBotConversations)
    .set({ updatedAt: new Date() })
    .where(eq(slaBotConversations.id, input.conversationId));
  return rows[0]!;
}

export async function createAlert(input: {
  memberId: string;
  conversationId: string | null;
  kind: string;
  severity: string;
  summary: string;
  detail: string;
  emailTo: string | null;
  emailSent: boolean;
}): Promise<SlaBotAlert> {
  const rows = await db
    .insert(slaBotAlerts)
    .values({
      memberId: input.memberId,
      conversationId: input.conversationId,
      kind: input.kind,
      severity: input.severity,
      summary: input.summary.slice(0, 500),
      detail: input.detail,
      emailTo: input.emailTo,
      emailSent: input.emailSent,
    })
    .returning();
  return rows[0]!;
}

export async function listOpenAlerts(limit = 50): Promise<
  (SlaBotAlert & {
    memberEmail: string | null;
    memberName: string | null;
  })[]
> {
  const rows = await db
    .select({
      alert: slaBotAlerts,
      memberEmail: staff.email,
      memberName: staff.fullName,
    })
    .from(slaBotAlerts)
    .innerJoin(staff, eq(slaBotAlerts.memberId, staff.id))
    .where(isNull(slaBotAlerts.resolvedAt))
    .orderBy(desc(slaBotAlerts.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r.alert,
    memberEmail: r.memberEmail,
    memberName: r.memberName,
  }));
}

export async function resolveAlert(id: string): Promise<SlaBotAlert | undefined> {
  const rows = await db
    .update(slaBotAlerts)
    .set({ resolvedAt: new Date() })
    .where(and(eq(slaBotAlerts.id, id), isNull(slaBotAlerts.resolvedAt)))
    .returning();
  return rows[0];
}

export async function replaceKnowledge(
  chunks: { sourceType: string; sourceId: string; title: string; body: string }[],
  audience: SlaBotAudience = "learner",
): Promise<number> {
  await db
    .delete(slaBotKnowledge)
    .where(eq(slaBotKnowledge.audience, audience));
  if (chunks.length === 0) return 0;
  await db.insert(slaBotKnowledge).values(
    chunks.map((c) => ({
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      title: c.title.slice(0, 255),
      body: c.body,
      audience,
      updatedAt: new Date(),
    })),
  );
  return chunks.length;
}

export async function searchKnowledge(
  query: string,
  limit = 8,
  audience: SlaBotAudience = "learner",
): Promise<SlaBotKnowledgeChunk[]> {
  const scoped = await db
    .select()
    .from(slaBotKnowledge)
    .where(eq(slaBotKnowledge.audience, audience))
    .orderBy(desc(slaBotKnowledge.updatedAt));
  return rankKnowledgeChunks(query, scoped, limit);
}

export async function knowledgeCount(
  audience?: SlaBotAudience,
): Promise<number> {
  const rows = audience
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(slaBotKnowledge)
        .where(eq(slaBotKnowledge.audience, audience))
    : await db
        .select({ n: sql<number>`count(*)::int` })
        .from(slaBotKnowledge);
  return Number(rows[0]?.n ?? 0);
}

export async function listKnowledgeSample(limit = 5): Promise<SlaBotKnowledgeChunk[]> {
  return db
    .select()
    .from(slaBotKnowledge)
    .orderBy(asc(slaBotKnowledge.title))
    .limit(limit);
}
