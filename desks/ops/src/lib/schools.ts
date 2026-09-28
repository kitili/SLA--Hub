/**
 * Silverleaf Academy campuses — synced from the transport master Google Sheet.
 * Regenerate roster: python3 scripts/import-from-sheet.py
 */

export const SILVERLEAF_CAMPUSES = [
  { name: "Usariver Campus", slug: "usariver" },
  { name: "Arusha Modern Campus", slug: "arusha-modern" },
  { name: "Kijenge Campus", slug: "kijenge" },
  { name: "Ilboru Campus", slug: "ilboru" },
  { name: "Boma Campus", slug: "boma" },
] as const;

/** When unset, queries return rows for all campuses (real sheet data). */
export type SchoolScope = string | undefined;
