/**
 * Helpers for seeding materials without wiping admin uploads.
 * Pure — safe to unit test.
 */

export interface MaterialSeedLike {
  id: string;
  storageKey: string;
  contentType: string;
  size: number;
}

/**
 * True when a materials row looks like an admin/runtime upload rather than a
 * seeded legacy path placeholder under `documents/`.
 */
export function isPreservedUploadMaterial(m: MaterialSeedLike): boolean {
  const key = m.storageKey.trim();
  if (key.startsWith("http://") || key.startsWith("https://")) return true;
  if (m.contentType === "video/youtube") return true;
  // LocalFileStorage keys are flat (no folders) and carry a real byte size.
  if (!key.includes("/") && !key.includes("\\") && m.size > 0) return true;
  return false;
}

export interface MaterialSeedPlan {
  /** Seed placeholder rows that already exist — leave alone. */
  keepSeedKeys: string[];
  /** Seed paths to insert as size-0 legacy placeholders. */
  insertSeedKeys: string[];
  /** Non-upload rows whose path is no longer in hub-content — delete. */
  deleteIds: string[];
  /** When true, skip inserting seed placeholders (item already has uploads). */
  skipSeedInserts: boolean;
}

/**
 * Plan how to sync one item's materials on `db:seed` without deleting Blob /
 * local uploads.
 */
export function planMaterialSeedSync(
  existing: MaterialSeedLike[],
  seedFilePaths: string[],
): MaterialSeedPlan {
  const seedKeys = [...new Set(seedFilePaths.map((p) => p.trim()).filter(Boolean))];
  const seedKeySet = new Set(seedKeys);
  const hasUploads = existing.some(isPreservedUploadMaterial);

  const deleteIds: string[] = [];
  const keepSeedKeys: string[] = [];

  for (const row of existing) {
    if (isPreservedUploadMaterial(row)) continue;
    if (seedKeySet.has(row.storageKey)) {
      keepSeedKeys.push(row.storageKey);
      continue;
    }
    deleteIds.push(row.id);
  }

  if (hasUploads) {
    return {
      keepSeedKeys,
      insertSeedKeys: [],
      deleteIds,
      skipSeedInserts: true,
    };
  }

  const existingSeed = new Set(keepSeedKeys);
  const insertSeedKeys = seedKeys.filter((k) => !existingSeed.has(k));

  return {
    keepSeedKeys,
    insertSeedKeys,
    deleteIds,
    skipSeedInserts: false,
  };
}
