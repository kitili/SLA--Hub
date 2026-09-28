/**
 * AI generations schema — one row per AI lesson-plan generation request.
 *
 * New in the lesson-plans wave. Tracks the lifecycle of a single- or batch-mode
 * generation: the requesting staff member, model, input params, status, and
 * the resulting plan ids on success.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staff } from "./staff";

/** Whether the request generated one plan or a batch over a scheme. */
export type AiGenerationMode = "single" | "batch";
/** Lifecycle of a generation request. */
export type AiGenerationStatus =
  | "pending"
  | "streaming"
  | "succeeded"
  | "failed"
  | "partial";

export const aiGenerations = pgTable("ai_generations", {
  /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => staff.id),
  mode: text("mode").$type<AiGenerationMode>().notNull(),
  modelId: text("model_id").notNull(),
  inputParams: jsonb("input_params").$type<Record<string, unknown>>().notNull(),
  status: text("status").$type<AiGenerationStatus>().notNull(),
  /**
   * Resulting lesson-plan ids on success. Provenance only — this audit row
   * must survive deletion of the plans it produced, hence ids in jsonb rather
   * than foreign keys.
   */
  resultPlanIds: jsonb("result_plan_ids").$type<string[]>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type AiGeneration = typeof aiGenerations.$inferSelect;
export type NewAiGeneration = typeof aiGenerations.$inferInsert;
