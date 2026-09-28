import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Rounds to 5 decimal places (~1.1m precision) so near-identical coordinate
 * sequences (e.g. re-fetched from slightly different float precision) share
 * a cache row. */
export function hashCoords(points: { lat: number; lng: number }[]): string {
  const canonical = points
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export async function getCachedGeometry(
  supabase: SupabaseClient,
  hash: string,
): Promise<[number, number][] | null> {
  const { data, error } = await supabase
    .from("route_geometry_cache")
    .select("geometry")
    .eq("coord_hash", hash)
    .maybeSingle();

  if (error || !data) return null;

  // Bump last_used_at on hit; best-effort, don't block the response on it.
  void supabase
    .from("route_geometry_cache")
    .update({ last_used_at: new Date().toISOString() })
    .eq("coord_hash", hash)
    .then(() => {});

  return data.geometry as [number, number][];
}

export async function saveGeometry(
  supabase: SupabaseClient,
  hash: string,
  geometry: [number, number][],
  stopCount: number,
): Promise<void> {
  await supabase.from("route_geometry_cache").upsert({
    coord_hash: hash,
    geometry,
    stop_count: stopCount,
  });
}
