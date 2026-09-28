/**
 * Cluster trip GPS pings into candidate stop centers (greedy distance clustering).
 * Shared by admin API; CLI twin lives in scripts/cluster-stops-from-trips.mjs.
 */

const EARTH_M = 6371000;

export const CLUSTER_DEFAULTS = {
  radiusM: 75,
  minPoints: 3,
  maxStopsPerRoute: 25,
  /** Only auto-fill routes that already have this many or fewer stops. */
  maxExistingStops: 2,
} as const;

export type LatLng = { lat: number; lng: number };

export type ClusterCenter = LatLng & { count: number };

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function clusterPoints(
  points: LatLng[],
  radiusM: number = CLUSTER_DEFAULTS.radiusM,
  options?: { minPoints?: number; maxStops?: number },
): ClusterCenter[] {
  const minPoints = options?.minPoints ?? CLUSTER_DEFAULTS.minPoints;
  const maxStops = options?.maxStops ?? CLUSTER_DEFAULTS.maxStopsPerRoute;

  type Acc = {
    count: number;
    sumLat: number;
    sumLng: number;
  };
  const clusters: Acc[] = [];

  for (const p of points) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i]!;
      const center = { lat: c.sumLat / c.count, lng: c.sumLng / c.count };
      const d = haversineM(center, p);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0 && bestDist <= radiusM) {
      const c = clusters[best]!;
      c.sumLat += p.lat;
      c.sumLng += p.lng;
      c.count += 1;
    } else {
      clusters.push({
        count: 1,
        sumLat: p.lat,
        sumLng: p.lng,
      });
    }
  }

  return clusters
    .map((c) => ({
      lat: c.sumLat / c.count,
      lng: c.sumLng / c.count,
      count: c.count,
    }))
    .filter((c) => c.count >= minPoints)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxStops);
}

export type ClusterStopsInput = {
  supabase: {
    from: (table: string) => any;
  };
  apply: boolean;
  radiusM?: number;
  busId?: string;
  routeId?: string;
  schoolId?: string;
};

export type ClusterStopsResult = {
  dryRun: boolean;
  radiusM: number;
  plans: Array<{
    busId: string;
    plate: string | null;
    routeId: string;
    skip?: string;
    points?: number;
    clusters?: ClusterCenter[];
    existingStops?: number;
    wrote?: number;
  }>;
};

export async function runClusterStopsFromTrips(
  input: ClusterStopsInput,
): Promise<ClusterStopsResult> {
  const radiusM = input.radiusM ?? CLUSTER_DEFAULTS.radiusM;
  const supabase = input.supabase;

  let busesQ = supabase
    .from("buses")
    .select("id, plate_number, label, school_id, route_id")
    .not("route_id", "is", null);

  if (input.busId) busesQ = busesQ.eq("id", input.busId);
  if (input.routeId) busesQ = busesQ.eq("route_id", input.routeId);
  if (input.schoolId) busesQ = busesQ.eq("school_id", input.schoolId);

  const { data: buses, error: busesErr } = await busesQ;
  if (busesErr) throw new Error(busesErr.message);
  if (!buses?.length) {
    return { dryRun: !input.apply, radiusM, plans: [] };
  }

  const routeIds = [
    ...new Set(
      (buses as { route_id: string }[])
        .map((b) => b.route_id)
        .filter(Boolean),
    ),
  ];
  const { data: routeStopRows } = await supabase
    .from("route_stops")
    .select("route_id")
    .in("route_id", routeIds);

  const stopCountByRoute = new Map<string, number>();
  for (const row of (routeStopRows ?? []) as { route_id: string }[]) {
    stopCountByRoute.set(
      row.route_id,
      (stopCountByRoute.get(row.route_id) ?? 0) + 1,
    );
  }

  const plans: ClusterStopsResult["plans"] = [];

  for (const bus of buses as {
    id: string;
    plate_number: string | null;
    label: string | null;
    school_id: string;
    route_id: string;
  }[]) {
    const plateLabel = bus.label ?? bus.plate_number;
    const existing = stopCountByRoute.get(bus.route_id) ?? 0;
    if (existing > CLUSTER_DEFAULTS.maxExistingStops) {
      plans.push({
        busId: bus.id,
        plate: plateLabel,
        routeId: bus.route_id,
        skip: `already has ${existing} route_stops`,
      });
      continue;
    }

    const { data: trips, error: tripsErr } = await supabase
      .from("trips")
      .select("id")
      .eq("bus_id", bus.id)
      .limit(200);
    if (tripsErr) throw new Error(tripsErr.message);

    const tripIds = ((trips ?? []) as { id: string }[]).map((t) => t.id);
    if (tripIds.length === 0) {
      plans.push({
        busId: bus.id,
        plate: plateLabel,
        routeId: bus.route_id,
        skip: "no trips",
      });
      continue;
    }

    const { data: locs, error: locErr } = await supabase
      .from("trip_locations")
      .select("lat, lng")
      .in("trip_id", tripIds)
      .limit(5000);
    if (locErr) throw new Error(locErr.message);

    const points = ((locs ?? []) as { lat: number; lng: number }[])
      .filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      )
      .map((p) => ({ lat: p.lat, lng: p.lng }));

    if (points.length < CLUSTER_DEFAULTS.minPoints) {
      plans.push({
        busId: bus.id,
        plate: plateLabel,
        routeId: bus.route_id,
        skip: `only ${points.length} GPS points`,
      });
      continue;
    }

    const clusters = clusterPoints(points, radiusM);
    if (clusters.length === 0) {
      plans.push({
        busId: bus.id,
        plate: plateLabel,
        routeId: bus.route_id,
        skip: "no clusters met min point threshold",
      });
      continue;
    }

    const plan: ClusterStopsResult["plans"][number] = {
      busId: bus.id,
      plate: plateLabel,
      routeId: bus.route_id,
      points: points.length,
      clusters,
      existingStops: existing,
    };

    if (!input.apply) {
      plans.push(plan);
      continue;
    }

    const stopIds: string[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i]!;
      const { data: nearby } = await supabase
        .from("stops")
        .select("id, lat, lng")
        .eq("school_id", bus.school_id)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(200);

      let stopId: string | null = null;
      for (const s of (nearby ?? []) as {
        id: string;
        lat: number;
        lng: number;
      }[]) {
        if (
          typeof s.lat === "number" &&
          typeof s.lng === "number" &&
          haversineM({ lat: s.lat, lng: s.lng }, c) <= radiusM
        ) {
          stopId = s.id;
          await supabase
            .from("stops")
            .update({ lat: c.lat, lng: c.lng, kind: "pickup" })
            .eq("id", s.id);
          break;
        }
      }

      if (!stopId) {
        const { data: created, error: createErr } = await supabase
          .from("stops")
          .insert({
            school_id: bus.school_id,
            name: `Cluster stop ${i + 1}`,
            lat: c.lat,
            lng: c.lng,
            kind: "pickup",
          })
          .select("id")
          .single();
        if (createErr) throw new Error(createErr.message);
        stopId = (created as { id: string }).id;
      }
      stopIds.push(stopId);
    }

    await supabase.from("route_stops").delete().eq("route_id", bus.route_id);
    const { error: rsErr } = await supabase.from("route_stops").insert(
      stopIds.map((stopId, order) => ({
        route_id: bus.route_id,
        stop_id: stopId,
        stop_order: order,
        eta_offset_minutes: null,
      })),
    );
    if (rsErr) throw new Error(rsErr.message);

    plan.wrote = stopIds.length;
    plans.push(plan);
  }

  return { dryRun: !input.apply, radiusM, plans };
}

