import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tools, toolConditionEnum } from "./tools";
import { users } from "./users";

export const toolConditions = pgTable("tool_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => tools.id, { onDelete: "cascade" }),
  condition: toolConditionEnum("condition").notNull(),
  note: text("note"),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
