/**
 * Per-policy digital signatures — one signed acknowledgement per learning item.
 */
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const policySignatures = pgTable(
  "policy_signatures",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    /** section_items.id — e.g. 2-1 Staff handbook */
    itemId: varchar("item_id", { length: 50 }).notNull(),
    /** Typed full name used as the digital signature. */
    signedName: varchar("signed_name", { length: 255 }).notNull(),
    acknowledgedText: text("acknowledged_text").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("policy_signatures_member_item_unique").on(
      table.memberId,
      table.itemId,
    ),
    index("idx_policy_signatures_member").on(table.memberId),
  ],
);

export type PolicySignature = typeof policySignatures.$inferSelect;
export type NewPolicySignature = typeof policySignatures.$inferInsert;
