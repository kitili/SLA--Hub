/**
 * Sign-off schema — content versioning + formal acknowledgements.
 *
 * New in Wave 3.
 *
 *   - `content_versions` labels a snapshot of the onboarding content that staff
 *     acknowledge against. A signoff points at the version that was effective
 *     when it was made, so we can prove *what* a member signed off on.
 *   - `signoffs` is a member's formal acknowledgement (e.g. "I have read and
 *     understood all onboarding materials"), capturing the exact text shown.
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

/** A labelled snapshot of onboarding content for acknowledgement/audit. */
export const contentVersions = pgTable("content_versions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /** Human-readable label, e.g. "Initial seed — 2026-06". */
  label: text("label").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A member's formal acknowledgement of a content version. */
export const signoffs = pgTable(
  "signoffs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    contentVersionId: uuid("content_version_id")
      .notNull()
      .references(() => contentVersions.id, { onDelete: "restrict" }),
    /** Verbatim declaration text the member agreed to (audit trail). */
    acknowledgedText: text("acknowledged_text").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_signoffs_member").on(table.memberId)],
);

export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;
export type Signoff = typeof signoffs.$inferSelect;
export type NewSignoff = typeof signoffs.$inferInsert;
