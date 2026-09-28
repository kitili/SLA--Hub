/**
 * Road-following route geometry via the free public OSRM demo server
 * (router.project-osrm.org) — no signup, no key, no card. This is the
 * last-resort tier after ORS and Google both fail or are unconfigured.
 *
 * IMPORTANT: this is OSRM's own public demo instance, explicitly documented
 * by OSRM as not intended for production traffic -- no SLA, no support, and
 * it can rate-limit or reject requests without warning. Treat a failure here
 * the same as any other tier failing (fall back further, never throw), and
 * do not depend on it being available.
 */

const OSRM_DEMO_URL = "https://router.project-osrm.org/route/v1/driving/";

export type OsrmGeometryResult =
  | { ok: true; coordinates: [number, number][] } // [lng, lat] pairs, same order as ORS/cache
  | { ok: false; reason: "too_few_points" | "osrm_error"; detail?: string };

export async function fetchOsrmGeometry(
  points: { lat: number; lng: number }[],
): Promise<OsrmGeometryResult> {
  if (points.length < 2) {
    return { ok: false, reason: "too_few_points" };
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_DEMO_URL}${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: "osrm_error", detail: text.slice(0, 200) };
    }

    const data = (await res.json()) as {
      code?: string;
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    if (data.code !== "Ok") {
      return { ok: false, reason: "osrm_error", detail: data.code ?? "no route" };
    }
    const coordinates = data.routes?.[0]?.geometry?.coordinates;
    if (!coordinates) {
      return { ok: false, reason: "osrm_error", detail: "No geometry in response" };
    }

    return { ok: true, coordinates };
  } catch (e) {
    return {
      ok: false,
      reason: "osrm_error",
      detail: e instanceof Error ? e.message : "Request failed",
    };
  }
}
