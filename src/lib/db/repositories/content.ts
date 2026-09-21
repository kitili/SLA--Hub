import "server-only";

/**
 * Content repository — read the onboarding content tree (sections + items).
 *
 * Thin and typed: returns rows as-is (including both `*_en` / `*_sw` columns).
 * Locale resolution is the caller's job via `resolveLocalized` — see
 * docs/i18n-content.md. Visibility filtering (roles) is layered on elsewhere;
 * this repo is the raw content reader.
 */
import { asc, eq } from "drizzle-orm";

import { db } from "../client";
import {
  sectionItems,
  sections,
  type Section,
  type SectionItem,
} from "../schema";

/** A section with its items attached, ordered. */
export interface SectionWithItems extends Section {
  items: SectionItem[];
}

/** List published sections (ordered) — without items. */
export async function listSections(): Promise<Section[]> {
  return db
    .select()
    .from(sections)
    .where(eq(sections.isPublished, true))
    .orderBy(asc(sections.order));
}

/** Fetch a single section by slug id, or `undefined`. */
export async function findSectionById(
  id: string,
): Promise<Section | undefined> {
  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.id, id))
    .limit(1);
  return rows[0];
}

/** List items belonging to a section, ordered. */
export async function listItemsForSection(
  sectionId: string,
): Promise<SectionItem[]> {
  return db
    .select()
    .from(sectionItems)
    .where(eq(sectionItems.sectionId, sectionId))
    .orderBy(asc(sectionItems.order));
}

/**
 * The full content tree: every published section with its items attached,
 * ordered. One query per relation, stitched in memory (small, fixed dataset).
 */
export async function getSectionsWithItems(): Promise<SectionWithItems[]> {
  const [sectionRows, itemRows] = await Promise.all([
    listSections(),
    db.select().from(sectionItems).orderBy(asc(sectionItems.order)),
  ]);

  const itemsBySection = new Map<string, SectionItem[]>();
  for (const item of itemRows) {
    const bucket = itemsBySection.get(item.sectionId);
    if (bucket) bucket.push(item);
    else itemsBySection.set(item.sectionId, [item]);
  }

  return sectionRows.map((section) => ({
    ...section,
    items: itemsBySection.get(section.id) ?? [],
  }));
}
