/**
 * One-shot: remove separate Central Team video items that were folded into 1-4.
 */
import { inArray, like } from "drizzle-orm";

import { db } from "../client";
import { materials, sectionItems } from "../schema";

const ORPHAN_IDS = [
  "1-ct-aloyce",
  "1-ct-grace",
  "1-ct-julius",
  "1-ct-lilian",
  "1-ct-ludwigy",
  "1-ct-neema",
  "1-ct-paul",
] as const;

async function main() {
  await db
    .delete(materials)
    .where(inArray(materials.sectionItemId, [...ORPHAN_IDS]));
  const deleted = await db
    .delete(sectionItems)
    .where(inArray(sectionItems.id, [...ORPHAN_IDS]))
    .returning();

  // Also catch any leftover 1-ct-* ids
  const leftover = await db
    .select({ id: sectionItems.id })
    .from(sectionItems)
    .where(like(sectionItems.id, "1-ct-%"));
  if (leftover.length) {
    const ids = leftover.map((r) => r.id);
    await db.delete(materials).where(inArray(materials.sectionItemId, ids));
    await db.delete(sectionItems).where(inArray(sectionItems.id, ids));
  }

  console.log(
    `[cleanup] removed ${deleted.length} orphan Central Team video items`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[cleanup] failed:", err);
    process.exit(1);
  });
