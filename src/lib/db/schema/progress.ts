/**
 * Progress tables — per-staff document reads and checkpoint completions.
 *
 * Ported 1:1 (semantics) from `legacy/server/db/schema.sql`:
 *   - composite primary keys
 *   - foreign key to staff(id) ON DELETE CASCADE
 *   - timestamptz defaults of now()
 *   - supporting indexes (idx_reads_staff, idx_checkpoint_staff)
 */
import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { staff } from "./staff";

/** One row per (staff, content item) the staff member has marked as read. */
export const documentReads = pgTable(
  "document_reads",
  {
    staffId: uuidFk("staff_id"),
    itemId: varchar("item_id", { length: 50 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.itemId] }),
    index("idx_reads_staff").on(table.staffId),
  ],
);

/** One row per (staff, checkpoint) the staff member has passed. */
export const checkpointCompletions = pgTable(
  "checkpoint_completions",
  {
    staffId: uuidFk("staff_id"),
    checkpointId: varchar("checkpoint_id", { length: 50 }).notNull(),
    passedAt: timestamp("passed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.checkpointId] }),
    index("idx_checkpoint_staff").on(table.staffId),
  ],
);

/**
 * Shared column factory for the `staff_id` FK so both child tables declare an
 * identical NOT NULL uuid referencing staff(id) with ON DELETE CASCADE.
 */
function uuidFk(name: string) {
  return uuid(name)
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" });
}

export type DocumentRead = typeof documentReads.$inferSelect;
export type NewDocumentRead = typeof documentReads.$inferInsert;
export type CheckpointCompletion = typeof checkpointCompletions.$inferSelect;
export type NewCheckpointCompletion = typeof checkpointCompletions.$inferInsert;
