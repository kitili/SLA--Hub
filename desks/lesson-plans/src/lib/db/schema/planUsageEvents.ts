/**
 * Plan usage events schema — append-only log of staff interactions with plans.
 *
 * New in the lesson-plans wave. One row per view / open / download, used for
 * "recently used", popularity, and engagement metrics.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { lessonPlans } from "./lessonPlans";
import { staff } from "./staff";

/** Interaction kinds we log. */
export type UsageEventType = "view" | "open" | "download";

export const planUsageEvents = pgTable(
  "plan_usage_events",
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
    eventType: text("event_type").$type<UsageEventType>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plan_usage_events_staff_occurred_idx").on(
      table.staffId,
      table.occurredAt.desc(),
    ),
    index("plan_usage_events_plan_occurred_idx").on(
      table.planId,
      table.occurredAt,
    ),
  ],
);

export type PlanUsageEvent = typeof planUsageEvents.$inferSelect;
export type NewPlanUsageEvent = typeof planUsageEvents.$inferInsert;
