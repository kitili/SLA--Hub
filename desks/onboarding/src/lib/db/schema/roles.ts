/**
 * Roles schema — lightweight RBAC for content visibility (default-open).
 *
 * New in Wave 3.
 *
 *   - `roles`                a named role (e.g. "Teacher", "Admin"). Keyed by a
 *                            stable slug. Bilingual display name.
 *   - `member_roles`         staff ↔ role assignments (composite-PK join).
 *   - `item_role_visibility` which roles may see which section items
 *                            (composite-PK join).
 *
 * VISIBILITY IS DEFAULT-OPEN: a section item with **no** `item_role_visibility`
 * rows is visible to everyone. Rows act as an allow-list only once present. This
 * keeps existing content visible without backfilling visibility rows.
 */
import { pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";

import { sectionItems } from "./content";
import { staff } from "./staff";

/** A named role. Keyed by slug, e.g. "teacher". Bilingual display name. */
export const roles = pgTable("roles", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name_en: varchar("name_en", { length: 150 }).notNull(),
  name_sw: varchar("name_sw", { length: 150 }),
});

/** Staff ↔ role assignment (join). */
export const memberRoles = pgTable(
  "member_roles",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    roleId: varchar("role_id", { length: 50 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.roleId] })],
);

/**
 * Allow-list of roles that may see a section item. NO rows for an item ⇒ the
 * item is visible to everyone (default-open).
 */
export const itemRoleVisibility = pgTable(
  "item_role_visibility",
  {
    sectionItemId: varchar("section_item_id", { length: 50 })
      .notNull()
      .references(() => sectionItems.id, { onDelete: "cascade" }),
    roleId: varchar("role_id", { length: 50 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.sectionItemId, table.roleId] })],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type MemberRole = typeof memberRoles.$inferSelect;
export type NewMemberRole = typeof memberRoles.$inferInsert;
export type ItemRoleVisibility = typeof itemRoleVisibility.$inferSelect;
export type NewItemRoleVisibility = typeof itemRoleVisibility.$inferInsert;
