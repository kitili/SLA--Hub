import { pgTable, uuid, text, integer, pgEnum } from "drizzle-orm/pg-core";

export const toolCategoryIconEnum = pgEnum("tool_category_icon", [
  "phone",
  "tablet",
  "laptop",
  "desktop",
  "projector",
  "camera",
  "printer",
  "other",
]);

export const toolCategories = pgTable("tool_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  icon: toolCategoryIconEnum("icon").notNull().default("other"),
  // Expected lifespan for straight-line depreciation of tools in this category. Null means
  // book value isn't computed for these tools (no assumption made).
  usefulLifeYears: integer("useful_life_years"),
});
