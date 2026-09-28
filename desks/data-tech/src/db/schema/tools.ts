import { pgTable, uuid, text, timestamp, date, numeric, pgEnum } from "drizzle-orm/pg-core";
import { toolCategories } from "./tool-categories";
import { toolLocations } from "./tool-locations";

export const toolStatusEnum = pgEnum("tool_status", ["available", "allocated", "in_repair", "retired"]);
export const toolConditionEnum = pgEnum("tool_condition", [
  "new",
  "good",
  "fair",
  "damaged",
  "faulty",
  "retired",
]);

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Encoded in the tool's QR label; also usable as a human-readable ID.
  assetTag: text("asset_tag").notNull().unique(),
  name: text("name").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => toolCategories.id, { onDelete: "restrict" }),
  locationId: uuid("location_id").references(() => toolLocations.id, { onDelete: "set null" }),
  brand: text("brand"),
  model: text("model"),
  specifications: text("specifications"),
  serialNumber: text("serial_number"),
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2, mode: "number" }),
  status: toolStatusEnum("status").notNull().default("available"),
  // Denormalized cache of the latest tool_conditions row, for fast list rendering.
  currentCondition: toolConditionEnum("current_condition").notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
