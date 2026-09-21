/**
 * Content schema — the onboarding content tree: `sections` and `section_items`.
 *
 * New in Wave 3. Replaces the file-based content tree (legacy
 * `legacy/server/data/hub-content.json`) with first-class DB rows so content can
 * be authored, versioned, and localized.
 *
 * ID alignment (CRITICAL — see docs/schema-conventions.md):
 *   - `sections.id`        is the section **slug** (e.g. "welcome", "policies").
 *   - `section_items.id`   is the legacy **item id** (e.g. "1-2", "2-3") so the
 *     existing `document_reads.item_id` rows keep referencing real items.
 *
 * Bilingual copy follows the `*_en` / `*_sw` column-pair convention (BINDING):
 * English is `NOT NULL` and is the fallback; Swahili is nullable. See
 * docs/i18n-content.md and the `resolveLocalized` helper.
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * The kind of asset a section item points at. Drives how the item renders /
 * is served. Derived from the legacy file extension (or explicit `type` in
 * hub-content.json) at seed time.
 */
export const sectionItemTypeEnum = pgEnum("section_item_type", [
  "pdf",
  "docx",
  "video",
  "image",
  "pptx",
  "link",
]);

/** Top-level onboarding sections, ordered. Keyed by slug. */
export const sections = pgTable(
  "sections",
  {
    /** Slug primary key, e.g. "welcome". Stable, human-readable. */
    id: varchar("id", { length: 100 }).primaryKey(),
    /** Display number (1-based), as shown to staff. */
    number: integer("number").notNull(),
    /** Sort order within the hub (defaults to `number`). */
    order: integer("order").notNull(),
    /** Emoji / icon token for the section header. */
    icon: varchar("icon", { length: 32 }),
    title_en: varchar("title_en", { length: 255 }).notNull(),
    title_sw: varchar("title_sw", { length: 255 }),
    description_en: text("description_en"),
    description_sw: text("description_sw"),
    /** Hide a section from staff without deleting it. */
    isPublished: boolean("is_published").notNull().default(true),
  },
  (table) => [index("idx_sections_order").on(table.order)],
);

/** Items within a section (documents, videos, links). Keyed by legacy item id. */
export const sectionItems = pgTable(
  "section_items",
  {
    /** Legacy item id, e.g. "1-2" — matches `document_reads.item_id`. */
    id: varchar("id", { length: 50 }).primaryKey(),
    sectionId: varchar("section_id", { length: 100 })
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    /** Sort order within the section. */
    order: integer("order").notNull(),
    type: sectionItemTypeEnum("type").notNull().default("pdf"),
    title_en: varchar("title_en", { length: 255 }).notNull(),
    title_sw: varchar("title_sw", { length: 255 }),
    /** Optional author note shown alongside the item. */
    note_en: text("note_en"),
    note_sw: text("note_sw"),
  },
  (table) => [index("idx_section_items_section").on(table.sectionId)],
);

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
export type SectionItem = typeof sectionItems.$inferSelect;
export type NewSectionItem = typeof sectionItems.$inferInsert;
