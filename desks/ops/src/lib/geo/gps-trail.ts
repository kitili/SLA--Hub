import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";
import type { TripLocation } from "@/types/database";

export type GpsTrailPoint = { lat: number; lng: number; recorded_at: string };

/** Ordered GPS pings suitable for map polyline + Google Maps link. */
export function normalizeGpsTrail(locations: TripLocation[]): GpsTrailPoint[] {
  return locations
    .filter(
      (loc) =>
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng) &&
        isPlausibleTanzaniaCoord(loc.lat, loc.lng),
    )
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    )
    .map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      recorded_at: loc.recorded_at,
    }));
}

export function trailToLatLngs(
  trail: GpsTrailPoint[],
): [number, number][] {
  return trail.map((p) => [p.lat, p.lng]);
}

/** Open the driven path in Google Maps (start → waypoints → end). */
export function googleMapsTrailUrl(trail: GpsTrailPoint[]): string | null {
  if (trail.length < 2) return null;
  const max = 20;
  const picked =
    trail.length <= max
      ? trail
      : [
          trail[0]!,
          ...Array.from({ length: max - 2 }, (_, i) => {
            const idx = Math.round(
              ((i + 1) * (trail.length - 1)) / (max - 1),
            );
            return trail[idx]!;
          }),
          trail[trail.length - 1]!,
        ];
  const path = picked.map((p) => `${p.lat},${p.lng}`).join("/");
  return `https://www.google.com/maps/dir/${path}`;
}
