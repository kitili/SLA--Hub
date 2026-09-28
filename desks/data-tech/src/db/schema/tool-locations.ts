import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const toolLocations = pgTable("tool_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
});
