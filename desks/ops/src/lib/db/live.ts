import { createClient } from "@/lib/supabase/server";
import { getSchoolToday } from "@/lib/date/schoolDate";
import type { TripLocation } from "@/types/database";

export type LiveBusPing = {
  trip_id: string;
  bus_id: string;
  bus_label: string;
  bus_plate: string;
  route_id: string | null;
  direction: string;
  status: string;
  departed_school_at: string | null;
  location: TripLocation | null;
  online: boolean;
  /** True when trip is active/departed but last GPS is older than 2 minutes. */
  gps_stale: boolean;
  /** Seconds since last ping; null if never pinged. */
  ping_age_seconds: number | null;
};

const ONLINE_WITHIN_MS = 90_000;
const STALE_ALERT_MS = 120_000;

/**
 * Active trips today + latest GPS ping (for Irene widget / Jfree live map).
 */
export async function getLiveBuses(): Promise<LiveBusPing[]> {
  const supabase = await createClient();
  const today = getSchoolToday();

  const { data: trips, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      bus_id,
      direction,
      status,
      departed_school_at,
      buses ( label, plate_number, route_id )
    `,
    )
    .eq("trip_date", today)
    .in("status", ["active", "scheduled"]);

  if (error || !trips) return [];

  const result: LiveBusPing[] = [];

  for (const trip of trips) {
    const bus = Array.isArray(trip.buses) ? trip.buses[0] : trip.buses;
    const { data: loc } = await supabase
      .from("trip_locations")
      .select(
        "id, trip_id, lat, lng, accuracy, speed, heading, recorded_at, recorded_by",
      )
      .eq("trip_id", trip.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const location = (loc as TripLocation | null) ?? null;
    const age = location
      ? Date.now() - new Date(location.recorded_at).getTime()
      : Infinity;
    const running =
      trip.status === "active" || Boolean(trip.departed_school_at);

    result.push({
      trip_id: trip.id,
      bus_id: trip.bus_id,
      bus_label: bus?.label ?? "",
      bus_plate: bus?.plate_number ?? "",
      route_id: bus?.route_id ?? null,
      direction: trip.direction,
      status: trip.status,
      departed_school_at: trip.departed_school_at ?? null,
      location,
      online: age <= ONLINE_WITHIN_MS,
      gps_stale: running && age > STALE_ALERT_MS,
      ping_age_seconds: Number.isFinite(age)
        ? Math.round(age / 1000)
        : null,
    });
  }

  return result;
}
