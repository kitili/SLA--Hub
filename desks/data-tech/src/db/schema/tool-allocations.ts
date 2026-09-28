import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tools } from "./tools";
import { users } from "./users";
import { departments } from "./departments";
import { toolLocations } from "./tool-locations";

// Single allocation = one row. Bulk allocation = several rows sharing a batchId.
export const toolAllocations = pgTable(
  "tool_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    // Deprecated for new allocations — tools are given to a requester (free text, see
    // allocatedToPersonName below), not necessarily to someone with a login. Left in place
    // so any historical rows that do reference a user stay intact.
    allocatedToUserId: uuid("allocated_to_user_id").references(() => users.id, { onDelete: "set null" }),
    // The requester's name — a person, not necessarily a system user.
    allocatedToPersonName: text("allocated_to_person_name"),
    allocatedToDepartmentId: uuid("allocated_to_department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    // Distributing a tool to a place rather than a person/department (e.g. a printer left at a branch office).
    allocatedToLocationId: uuid("allocated_to_location_id").references(() => toolLocations.id, {
      onDelete: "set null",
    }),
    batchId: uuid("batch_id"),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
    expectedReturnAt: timestamp("expected_return_at", { withTimezone: true }),
    purpose: text("purpose"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    allocatedBy: uuid("allocated_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
  },
  (table) => [
    // A tool can only have one active (not yet returned) allocation at a time.
    uniqueIndex("tool_allocations_active_tool_idx")
      .on(table.toolId)
      .where(sql`${table.returnedAt} IS NULL`),
  ],
);
