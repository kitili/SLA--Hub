import { measurePathKm } from "@/lib/routing/optimize";

type RouteStopPoint = {
  route_id: string;
  stop_order: number;
  lat: number | null;
  lng: number | null;
};

/**
 * Straight-line (haversine) distance summed across every active route's own
 * stop order, one-way -- the same approximation RoutePerformancePanel already
 * uses for its own before/after km figures, not actual road distance. Good
 * enough for a fleet-wide cost-per-km efficiency ratio, not for routing.
 */
export function computeFleetDistanceKm(rows: RouteStopPoint[]): number {
  const byRoute = new Map<string, RouteStopPoint[]>();
  for (const row of rows) {
    const list = byRoute.get(row.route_id) ?? [];
    list.push(row);
    byRoute.set(row.route_id, list);
  }

  let total = 0;
  for (const stops of byRoute.values()) {
    const ordered = [...stops].sort((a, b) => a.stop_order - b.stop_order);
    total += measurePathKm(
      ordered.map((s) => ({ id: "", lat: s.lat ?? NaN, lng: s.lng ?? NaN })),
    );
  }
  return total;
}
