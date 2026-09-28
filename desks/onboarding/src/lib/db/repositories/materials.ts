import "server-only";

/**
 * Materials repository — metadata records for uploaded files. Pairs with the
 * storage adapters in src/lib/storage (which own the bytes); these functions
 * own the row that says where the bytes live.
 */
import { desc, eq } from "drizzle-orm";

import { db } from "../client";
import { materials, type Material, type NewMaterial } from "../schema";

/** Insert a material metadata row and return it. */
export async function createMaterial(input: NewMaterial): Promise<Material> {
  const rows = await db.insert(materials).values(input).returning();
  return rows[0]!;
}

/** Find a material by id, or `undefined`. */
export async function findMaterialById(
  id: string,
): Promise<Material | undefined> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  return rows[0];
}

/** Find a material by its storage key, or `undefined`. */
export async function findMaterialByStorageKey(
  storageKey: string,
): Promise<Material | undefined> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.storageKey, storageKey))
    .limit(1);
  return rows[0];
}

/** List materials attached to a given content item id, newest first. */
export async function listMaterialsByItem(
  ownerItemId: string,
): Promise<Material[]> {
  return db
    .select()
    .from(materials)
    .where(eq(materials.ownerItemId, ownerItemId))
    .orderBy(desc(materials.createdAt));
}

/** Delete a material metadata row by id. */
export async function deleteMaterial(id: string): Promise<void> {
  await db.delete(materials).where(eq(materials.id, id));
}
