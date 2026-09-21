/**
 * Per-section policy declarations — audit trail for declaration checkpoints.
 */
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const sectionDeclarations = pgTable(
  "section_declarations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id", { length: 50 }).notNull(),
    acknowledgedText: text("acknowledged_text").notNull(),
    declaredAt: timestamp("declared_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_section_declarations_member").on(table.memberId),
    index("idx_section_declarations_member_section").on(
      table.memberId,
      table.sectionId,
    ),
  ],
);

export type SectionDeclaration = typeof sectionDeclarations.$inferSelect;
export type NewSectionDeclaration = typeof sectionDeclarations.$inferInsert;
