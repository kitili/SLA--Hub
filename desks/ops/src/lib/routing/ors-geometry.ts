/**
 * Road-following route geometry via OpenRouteService — stubs when the key
 * is missing, same "degrade gracefully" shape as src/lib/messaging/admin-alert.ts.
 */

const ORS_DIRECTIONS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const MAX_WAYPOINTS = 50;

export type OrsGeometryResult =
  | { ok: true; coordinates: [number, number][] } // [lng, lat] pairs, ORS order
  | { ok: false; reason: "not_configured" | "too_many_waypoints" | "ors_error"; detail?: string };

export async function fetchOrsGeometry(
  points: { lat: number; lng: number }[],
): Promise<OrsGeometryResult> {
  const apiKey = process.env.ORS_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "not_configured" };
  }
  if (points.length > MAX_WAYPOINTS) {
    return { ok: false, reason: "too_many_waypoints" };
  }

  try {
    const res = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        coordinates: points.map((p) => [p.lng, p.lat]),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: "ors_error", detail: text.slice(0, 200) };
    }

    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) {
      return { ok: false, reason: "ors_error", detail: "No geometry in response" };
    }

    return { ok: true, coordinates };
  } catch (e) {
    return {
      ok: false,
      reason: "ors_error",
      detail: e instanceof Error ? e.message : "Request failed",
    };
  }
}
