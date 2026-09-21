/**
 * Onboarding feedback — soft reflection responses from new staff.
 */
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

/** One reflection submission per member (updated on resubmit). */
export const onboardingFeedback = pgTable(
  "onboarding_feedback",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .unique()
      .references(() => staff.id, { onDelete: "cascade" }),
    expectations: text("expectations"),
    unclear: text("unclear"),
    improvements: text("improvements"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_onboarding_feedback_member").on(table.memberId)],
);

export type OnboardingFeedback = typeof onboardingFeedback.$inferSelect;
export type NewOnboardingFeedback = typeof onboardingFeedback.$inferInsert;
