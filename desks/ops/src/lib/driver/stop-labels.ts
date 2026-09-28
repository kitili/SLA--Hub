/** Driver-facing labels — never show raw DB enums in the UI. */

import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";

const KIND_LABEL: Record<string, string> = {
  school: "School",
  pickup: "Pick-up",
  dropoff: "Drop-off",
  waypoint: "Stop",
};

export function stopKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Stop";
  return KIND_LABEL[kind] ?? "Stop";
}

export function tripDirectionLabel(direction: string | null | undefined): string {
  const d = (direction ?? "").toLowerCase();
  if (d === "am") return "Morning";
  if (d === "pm") return "Afternoon";
  return direction?.trim() || "Trip";
}

/** Build a Google Maps driving directions URL for the remaining stop chain. */
export function googleMapsDirectionsUrl(input: {
  stops: Array<{ lat: number | null; lng: number | null; name?: string }>;
  origin?: { lat: number; lng: number } | null;
}): string | null {
  const withCoords = input.stops.filter(
    (s): s is { lat: number; lng: number; name?: string } =>
      s.lat != null &&
      s.lng != null &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      isPlausibleTanzaniaCoord(s.lat, s.lng),
  );
  if (withCoords.length === 0) return null;

  const origin =
    input.origin ??
    ({ lat: withCoords[0].lat, lng: withCoords[0].lng } as const);
  const destination = withCoords[withCoords.length - 1];
  const waypoints = withCoords.slice(
    input.origin ? 0 : 1,
    withCoords.length - 1,
  );

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((w) => `${w.lat},${w.lng}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
