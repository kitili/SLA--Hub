// Straight-line depreciation to zero over the category's useful life. Returns null when
// any input needed to compute it is missing — callers show "—" in that case rather than a
// misleading number.
export function computeBookValue(
  purchasePrice: number | null | undefined,
  purchaseDate: string | null | undefined,
  usefulLifeYears: number | null | undefined,
) {
  if (!purchasePrice || !purchaseDate || !usefulLifeYears || usefulLifeYears <= 0) return null;

  const ageYears = (Date.now() - new Date(`${purchaseDate}T00:00:00Z`).getTime()) / (365.25 * 86_400_000);
  const fraction = Math.max(0, 1 - ageYears / usefulLifeYears);
  return Math.round(purchasePrice * fraction * 100) / 100;
}
