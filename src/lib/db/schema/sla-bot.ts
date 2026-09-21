/**
 * SLA-bot — onboarding helper chat, knowledge index, and admin alerts.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const slaBotConversations = pgTable(
  "sla_bot_conversations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    /** Separate chat history for the learner SLA-bot vs admin HR-bot. */
    audience: varchar("audience", { length: 20 }).notNull().default("learner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sla_bot_conversations_member").on(table.memberId),
    index("idx_sla_bot_conversations_audience").on(
      table.memberId,
      table.audience,
    ),
  ],
);

export const slaBotMessages = pgTable(
  "sla_bot_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => slaBotConversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    intent: varchar("intent", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sla_bot_messages_conversation").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const slaBotAlerts = pgTable(
  "sla_bot_alerts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => slaBotConversations.id,
      { onDelete: "set null" },
    ),
    kind: varchar("kind", { length: 40 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    summary: varchar("summary", { length: 500 }).notNull(),
    detail: text("detail").notNull(),
    emailTo: varchar("email_to", { length: 500 }),
    emailSent: boolean("email_sent").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sla_bot_alerts_created").on(table.createdAt),
    index("idx_sla_bot_alerts_resolved").on(table.resolvedAt),
  ],
);

export const slaBotKnowledge = pgTable(
  "sla_bot_knowledge",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    sourceId: varchar("source_id", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    /** `learner` = published hub content; `admin` = HR portal how-to. */
    audience: varchar("audience", { length: 20 }).notNull().default("learner"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sla_bot_knowledge_source").on(table.sourceType, table.sourceId),
    index("idx_sla_bot_knowledge_audience").on(table.audience),
  ],
);

export type SlaBotConversation = typeof slaBotConversations.$inferSelect;
export type SlaBotMessage = typeof slaBotMessages.$inferSelect;
export type SlaBotAlert = typeof slaBotAlerts.$inferSelect;
export type SlaBotKnowledgeChunk = typeof slaBotKnowledge.$inferSelect;
