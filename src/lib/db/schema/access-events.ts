import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const ACCESS_ACTIONS = [
  "signed_in",
  "signed_out",
  "opened_hub",
  "opened_desk",
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const accessEvents = pgTable(
  "access_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    departmentId: varchar("department_id", { length: 64 }),
    departmentName: varchar("department_name", { length: 120 }),
    path: varchar("path", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_access_events_created_at").on(table.createdAt),
    index("idx_access_events_staff_created").on(table.staffId, table.createdAt),
    index("idx_access_events_action").on(table.action),
  ],
);

export type AccessEvent = typeof accessEvents.$inferSelect;
export type NewAccessEvent = typeof accessEvents.$inferInsert;
