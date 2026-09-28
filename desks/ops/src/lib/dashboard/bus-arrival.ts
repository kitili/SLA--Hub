import { createClient } from "@/lib/supabase/server";
import { getBuses } from "@/lib/db/queries";
import { listAllRouteStopsForExport } from "@/lib/db/routes";
import { haversineKm } from "@/lib/routing/optimize";
import { computeEtaTimestamp } from "@/lib/routing/eta";

/** Close enough to the route's last stop to count as "arrived". */
const ARRIVAL_RADIUS_KM = 0.3;
/** Minutes of slack past the scheduled time before a trip counts as late. */
const ON_TIME_GRACE_MINUTES = 5;

export type OnTimeResult = {
  pct: number;
  onTimeCount: number;
  /** Trips that could actually be judged (route has a usable arrival stop
   * with an eta_offset_minutes, and at least one GPS ping ever got close to
   * it). Trips outside this count aren't misses -- they just can't be
   * scored, same as the source sheet's blank/#DIV!0 months. */
  classifiableCount: number;
};

/**
 * On-time % for AM trips reaching their route's last stop, for the given
 * date range. "Scheduled" = each route's own eta_offset_minutes for that
 * stop, applied to that trip's started_at.
 *
 * Uses the LAST stop by stop_order as the arrival point, not stops.kind ===
 * "school" -- checked against live data and only 1 of 562 real route_stops
 * rows is actually tagged kind='school' (a demo stop, not a real route), so
 * that flag isn't populated in practice. "Last stop on an AM route = school"
 * is a standard assumption for one-way pickup routes, but it's an assumption
 * -- worth tagging real school stops with kind='school' properly at some
 * point so this can key off that instead.
 */
export async function computeOnTimePct(
  from: string,
  to: string,
): Promise<OnTimeResult> {
  const supabase = await createClient();

  const [tripsRes, buses, routeStops] = await Promise.all([
    supabase
      .from("trips")
      .select("id, bus_id, started_at, departed_school_at")
      .eq("direction", "am")
      .gte("trip_date", from)
      .lte("trip_date", to)
      .not("started_at", "is", null),
    getBuses(),
    listAllRouteStopsForExport(),
  ]);

  const busRouteId = new Map(buses.map((b) => [b.id, b.route_id]));

  const lastStopByRoute = new Map<
    string,
    { lat: number; lng: number; etaOffsetMinutes: number; stopOrder: number }
  >();
  for (const s of routeStops) {
    if (s.lat == null || s.lng == null || s.eta_offset_minutes == null) continue;
    const existing = lastStopByRoute.get(s.route_id);
    if (existing && existing.stopOrder >= s.stop_order) continue;
    lastStopByRoute.set(s.route_id, {
      lat: s.lat,
      lng: s.lng,
      etaOffsetMinutes: s.eta_offset_minutes,
      stopOrder: s.stop_order,
    });
  }

  const classifiableTrips = (tripsRes.data ?? []).flatMap((trip) => {
    const routeId = busRouteId.get(trip.bus_id);
    const arrivalStop = routeId ? lastStopByRoute.get(routeId) : undefined;
    if (!arrivalStop) return [];
    const scheduled = computeEtaTimestamp(
      trip.started_at ?? trip.departed_school_at,
      arrivalStop.etaOffsetMinutes,
    );
    if (!scheduled) return [];
    return [{ tripId: trip.id as string, scheduled, arrivalStop }];
  });

  if (classifiableTrips.length === 0) {
    return { pct: 0, onTimeCount: 0, classifiableCount: 0 };
  }

  const { data: pings } = await supabase
    .from("trip_locations")
    .select("trip_id, lat, lng, recorded_at")
    .in(
      "trip_id",
      classifiableTrips.map((t) => t.tripId),
    )
    .order("recorded_at", { ascending: true });

  const pingsByTrip = new Map<
    string,
    { lat: number; lng: number; recorded_at: string }[]
  >();
  for (const p of pings ?? []) {
    const list = pingsByTrip.get(p.trip_id) ?? [];
    list.push(p);
    pingsByTrip.set(p.trip_id, list);
  }

  let onTimeCount = 0;
  let classifiableCount = 0;
  const graceMs = ON_TIME_GRACE_MINUTES * 60_000;

  for (const trip of classifiableTrips) {
    const tripPings = pingsByTrip.get(trip.tripId) ?? [];
    const arrivalPing = tripPings.find(
      (p) =>
        haversineKm({ lat: p.lat, lng: p.lng }, trip.arrivalStop) <=
        ARRIVAL_RADIUS_KM,
    );
    if (!arrivalPing) continue;

    classifiableCount++;
    const actual = new Date(arrivalPing.recorded_at);
    if (actual.getTime() <= trip.scheduled.getTime() + graceMs) {
      onTimeCount++;
    }
  }

  const pct =
    classifiableCount > 0
      ? Math.round((onTimeCount / classifiableCount) * 1000) / 10
      : 0;
  return { pct, onTimeCount, classifiableCount };
}
