/**
 * `materials` table — metadata for uploaded files (documents, videos).
 *
 * New in the Next.js migration (F2.5). The binary lives in a storage backend
 * (local filesystem in dev, Vercel Blob in prod — see src/lib/storage); this
 * row records where it lives and how to serve it.
 *
 * `owner_item_id` and `uploaded_by` are intentionally nullable: a material may
 * be uploaded before it is attached to a content item, and the uploader may be
 * unknown for legacy/seeded data. `owner_item_id` remains a **soft** (non-FK)
 * reference to a content item id for back-compat. As of Wave 3 the
 * `section_items` table exists, so `section_item_id` is the new **hard** FK
 * (nullable) used to attach a material to its item.
 */
import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sectionItems } from "./content";

export const materials = pgTable("materials", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /** Soft reference to a content item id; nullable until attached. */
  ownerItemId: varchar("owner_item_id", { length: 50 }),
  /** Hard FK to the owning section item; nullable until attached (Wave 3). */
  sectionItemId: varchar("section_item_id", { length: 50 }).references(
    () => sectionItems.id,
    { onDelete: "set null" },
  ),
  /** Language tag for the asset, e.g. "en" / "sw". */
  language: varchar("language", { length: 16 }),
  filename: varchar("filename", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 127 }).notNull(),
  /** Size in bytes. */
  size: integer("size").notNull(),
  /** Opaque storage key (path/blob key) used by the storage adapter. */
  storageKey: text("storage_key").notNull(),
  /** Public (or app-routable) URL to fetch the asset. */
  url: text("url").notNull(),
  /** Staff id of the uploader; nullable for seeded/legacy assets. */
  uploadedBy: uuid("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
