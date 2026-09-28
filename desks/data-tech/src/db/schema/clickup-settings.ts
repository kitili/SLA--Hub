import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Singleton row (the app reads the first record). Token may be empty when
// CLICKUP_API_TOKEN is supplied via environment instead.
export const clickupSettings = pgTable("clickup_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiToken: text("api_token"),
  teamId: text("team_id"),
  teamName: text("team_name"),
  spaceId: text("space_id"),
  spaceName: text("space_name"),
  listId: text("list_id"),
  listName: text("list_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
