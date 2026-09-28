import { pgTable, uuid, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

// One entry per dashboard tab. Keep in sync with MODULES in src/lib/modules.ts.
export const moduleEnum = pgEnum("module", [
  "tickets",
  "tech_tools",
  "systems",
  "users",
  "departments",
  "support_contacts",
  "ticket_notifications",
  "one_to_fives",
]);

export const accessLevelEnum = pgEnum("access_level", ["view", "manage"]);

// role = "admin" bypasses this table entirely (always full access to every module).
// Everyone else's access is exactly whatever rows they have here — no row means no access.
export const userModules = pgTable(
  "user_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: moduleEnum("module").notNull(),
    level: accessLevelEnum("level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_modules_user_module_idx").on(table.userId, table.module)],
);
