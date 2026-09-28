/**
 * Plan feedback schema — one rating (+ optional comment) per staff per plan.
 *
 * New in the lesson-plans wave. The unique (staff_id, plan_id) index enforces a
 * single feedback row per staff member per plan (upsert on conflict).
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { lessonPlans } from "./lessonPlans";
import { staff } from "./staff";

export const planFeedback = pgTable(
  "plan_feedback",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => lessonPlans.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("plan_feedback_staff_plan_idx").on(table.staffId, table.planId),
    index("plan_feedback_plan_idx").on(table.planId),
    index("plan_feedback_rating_idx").on(table.rating),
  ],
);

export type PlanFeedback = typeof planFeedback.$inferSelect;
export type NewPlanFeedback = typeof planFeedback.$inferInsert;
