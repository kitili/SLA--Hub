import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/admin";
import { fetchOrsGeometry } from "@/lib/routing/ors-geometry";
import { fetchOsrmGeometry } from "@/lib/routing/osrm-geometry";
import { getCachedGeometry, hashCoords, saveGeometry } from "@/lib/routing/geometry-cache";

type Point = { lat: number; lng: number };

/** Safely under every provider's per-request waypoint cap (ORS=50, OSRM
 * demo has none published but kept conservative too) -- chunk BEFORE
 * picking a provider so every tier can handle any given chunk, instead of
 * each provider needing its own chunk size. */
const MAX_CHUNK_SIZE = 25;

/** Overlapping chunks (each one starts where the previous ended) so the
 * stitched-together path has no gap at the seam. */
function chunkPoints(points: Point[], maxPerChunk: number): Point[][] {
  if (points.length <= maxPerChunk) return [points];
  const chunks: Point[][] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(start + maxPerChunk - 1, points.length - 1);
    chunks.push(points.slice(start, end + 1));
    if (end === points.length - 1) break;
    start = end;
  }
  return chunks;
}

/** ORS -> OSRM, in that order, for ONE chunk of points (each already
 * within every provider's waypoint cap). Returns null only when every tier
 * has failed.
 *
 * Deliberately just these two: both are rendered on our Leaflet/OpenStreetMap
 * map (see StopsMap.tsx), and both are fine to show there. Google Directions
 * was removed from this chain -- its results may only be displayed on a
 * Google Map per Google Maps Platform's ToS, and this app's map is OSM-tiled,
 * not Google's. Do not add it back here; the ToS-compliant place for a
 * Google-Directions-on-a-Google-map feature is DriverGoogleMap.tsx, which
 * already does that correctly on its own separate Google Map instance. */
async function fetchGeometryChain(
  points: Point[],
): Promise<[number, number][] | null> {
  const ors = await fetchOrsGeometry(points);
  if (ors.ok) return ors.coordinates;

  const osrm = await fetchOsrmGeometry(points);
  if (osrm.ok) return osrm.coordinates;

  return null;
}

/**
 * POST /api/routes/geometry — road geometry for ordered stops.
 * Tries OpenRouteService first, then the free OSRM public demo. Routes with
 * more stops than any single provider allows are split into overlapping
 * chunks, each run through the same two-tier chain, and stitched back into
 * one continuous path.
 *
 * Body: { points: { lat: number; lng: number }[] }
 * Returns: { coordinates: [lng, lat][] | null, provider?: string }
 */
export async function POST(request: Request) {
  const auth = await requireUser([
    "admin",
    "transport",
    "matron",
    "driver",
    "finance",
  ]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { points?: Point[] };
  const points = body.points ?? [];
  if (points.length < 2) {
    return NextResponse.json({ coordinates: null });
  }

  const supabase = createServiceClient();
  const hash = hashCoords(points);

  const cached = await getCachedGeometry(supabase, hash);
  if (cached) {
    return NextResponse.json({ coordinates: cached, provider: "cache" });
  }

  const chunks = chunkPoints(points, MAX_CHUNK_SIZE);
  const chunkResults = await Promise.all(
    chunks.map((chunk) => fetchGeometryChain(chunk)),
  );

  if (chunkResults.some((result) => result === null)) {
    // Any chunk failing means the stitched path would have a gap —
    // return null so the client can fall back (straight line / empty).
    return NextResponse.json({ coordinates: null });
  }

  const stitched: [number, number][] = [];
  for (let i = 0; i < chunkResults.length; i++) {
    const coords = chunkResults[i] as [number, number][];
    // Every chunk after the first repeats its first point (the previous
    // chunk's last stop) -- drop it so the seam doesn't produce a duplicate
    // vertex in the final line.
    stitched.push(...(i === 0 ? coords : coords.slice(1)));
  }

  await saveGeometry(supabase, hash, stitched, points.length);
  return NextResponse.json({ coordinates: stitched, provider: "chain" });
}
