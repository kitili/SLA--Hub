import "server-only";

/**
 * Member read/aggregate queries — the few reads the member experience needs
 * that go beyond the typed repositories.
 *
 * Kept deliberately small and read-mostly: imports `db` + schema directly only
 * where a repository does not already expose the shape we need. The one write
 * here (`ensureStartedAt`) is the onboarding-clock bootstrap, which has no home
 * in the (read-only-to-the-member-layer) staff repository.
 *
 * @see src/lib/dashboard.ts — the consumer that assembles the dashboard summary.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../client";
import {
  materials,
  sectionItems,
  staff,
  type Material,
} from "../schema";

/**
 * Ensure the member's onboarding clock has started: if `started_at` is null,
 * set it to `now()` (only the null case is written, so the original start date
 * is preserved on every later call). Returns the effective start timestamp.
 *
 * Idempotent and safe to call on every dashboard render.
 */
export async function ensureStartedAt(staffId: string): Promise<Date | null> {
  const rows = await db
    .select({ startedAt: staff.startedAt })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);

  const existing = rows[0]?.startedAt ?? null;
  if (existing) return existing;

  const now = new Date();
  // Only stamp when still null — never overwrites an existing clock, and avoids
  // racing two concurrent requests into different start dates.
  await db
    .update(staff)
    .set({ startedAt: now })
    .where(and(eq(staff.id, staffId), isNull(staff.startedAt)));

  // Re-read to return the effective value (handles a concurrent winner).
  const reread = await db
    .select({ startedAt: staff.startedAt })
    .from(staff)
    .where(eq(staff.id, staffId))
    .limit(1);
  return reread[0]?.startedAt ?? now;
}

/**
 * The first material attached to each of the given section-item ids, keyed by
 * item id. Used to resolve a viewable asset (pdf/video/image) per item.
 *
 * Returns a Map; items with no uploaded material simply have no entry (the UI
 * renders a "coming soon" state for those).
 */
export async function getMaterialsForItems(
  itemIds: string[],
): Promise<Map<string, Material[]>> {
  const byItem = new Map<string, Material[]>();
  if (itemIds.length === 0) return byItem;

  const rows = await db
    .select()
    .from(materials)
    .where(inArray(materials.sectionItemId, itemIds))
    .orderBy(asc(materials.createdAt));

  for (const row of rows) {
    const key = row.sectionItemId;
    if (!key) continue;
    const existing = byItem.get(key);
    if (existing) existing.push(row);
    else byItem.set(key, [row]);
  }
  return byItem;
}

/**
 * Resolve a single material by its opaque storage key (the value the /view
 * route receives as `?key=`). Returns the row plus its owning section item so
 * the viewer can render a title and link back to the section.
 */
export interface MaterialWithItem {
  material: Material;
  itemId: string | null;
  sectionId: string | null;
}

export async function findMaterialByKey(
  storageKey: string,
): Promise<MaterialWithItem | undefined> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.storageKey, storageKey))
    .limit(1);
  const material = rows[0];
  if (!material) return undefined;

  let sectionId: string | null = null;
  const itemId = material.sectionItemId ?? material.ownerItemId ?? null;
  if (material.sectionItemId) {
    const itemRows = await db
      .select({ sectionId: sectionItems.sectionId })
      .from(sectionItems)
      .where(eq(sectionItems.id, material.sectionItemId))
      .limit(1);
    sectionId = itemRows[0]?.sectionId ?? null;
  }

  return { material, itemId, sectionId };
}
