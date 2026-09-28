/** Fleet-wide occupancy % — riders divided by total seat capacity, rounded to
 * one decimal. Shared by the admin dashboard tile and the CEO KPI panel so
 * both always agree on the same number. */
export function computeFleetOccupancyPct(
  riderCount: number,
  buses: { capacity: number | null }[],
): number {
  const capacityTotal = buses.reduce((s, b) => s + (b.capacity || 0), 0);
  if (capacityTotal <= 0) return 0;
  return Math.round((riderCount / capacityTotal) * 1000) / 10;
}
