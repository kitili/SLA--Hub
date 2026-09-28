/** Map Ed-admin campus names to local Campus.code values. */
const CAMPUS_ALIASES: Record<string, string[]> = {
  USA: ["usa river", "usr", "usa"],
  AM: ["arusha town", "arusha city", "acc", "am ", " am"],
  KIJENGE: ["kijenge", "kjg"],
  ILBORU: ["ilboru", "ilb"],
  BOMA: ["boma", "bom"],
};

export function campusCodeFromEdadmin(name: string | null | undefined): string | null {
  const lower = (name ?? "").trim().toLowerCase();
  if (!lower) return null;
  for (const [code, aliases] of Object.entries(CAMPUS_ALIASES)) {
    if (aliases.some((alias) => lower.includes(alias))) return code;
  }
  return null;
}

export function normalizeGender(raw: string | null | undefined): string {
  const g = (raw ?? "").trim().toUpperCase();
  if (g.startsWith("M") || g === "BOY") return "BOY";
  if (g.startsWith("F") || g === "GIRL") return "GIRL";
  return "UNISEX";
}
