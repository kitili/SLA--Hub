import { pgTable, uuid, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { systems } from "./systems";

// Named stages of a system (Discovery, Build, Rollout). Distinct from ticket `phase`.
export const systemPhases = pgTable("system_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemId: uuid("system_id")
    .notNull()
    .references(() => systems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: text("goal"),
  position: integer("position").notNull().default(0),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
