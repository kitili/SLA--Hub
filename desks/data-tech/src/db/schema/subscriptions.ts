import { pgTable, uuid, text, date, boolean, timestamp } from "drizzle-orm/pg-core";

// Third-party platforms/services Silverleaf pays for on a recurring basis (Google
// Workspace, Adobe, hosting, domains, etc.) — distinct from the in-house "systems" catalog.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url"),
  // Manually updated by whoever renews it — no auto-advancing billing cycle.
  renewalDate: date("renewal_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
