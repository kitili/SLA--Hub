import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { departments } from "./departments";

// Many-to-many: which department(s) use a given subscription.
export const subscriptionDepartments = pgTable(
  "subscription_departments",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.subscriptionId, table.departmentId] })],
);
