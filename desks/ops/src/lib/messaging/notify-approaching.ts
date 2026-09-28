import { createClient } from "@/lib/supabase/server";
import { getStopsForTrip } from "@/lib/db/queries";
import { haversineKm } from "@/lib/routing/optimize";
import { sendAndLogMessage } from "@/lib/messaging/send";

const APPROACH_THRESHOLD_MINUTES = 10;
// Local/side-road pace approaching a stop (not highway cruising speed) — an
// approximation, not a real routed ETA. Documented trade-off: this can be
// off by several minutes depending on traffic and road conditions.
const ASSUMED_SPEED_KMH = 20;
// proximity_alerts.threshold_m is a distance column (the schema's own
// design assumes distance-based triggering); we trigger on time instead, so
// this is the distance-equivalent of the 10-minute threshold at the assumed
// speed, stored for reference rather than used to decide anything.
const THRESHOLD_M_EQUIVALENT =
  (ASSUMED_SPEED_KMH * (APPROACH_THRESHOLD_MINUTES / 60)) * 1000;

export type ApproachingStopNotifyResult = {
  stop_id: string;
  stop_name: string;
  eta_minutes: number;
  students_notified: number;
};

/**
 * Called on each GPS ping. Checks the trip's remaining stops for proximity
 * and fires a one-time "bus is ~10 min away" SMS to parents of students
 * assigned to that stop. Dedup is enforced by proximity_alerts' own partial
 * unique index on (trip_id, stop_id, kind) while status is open/notified —
 * the insert only succeeds once per stop per trip, so concurrent/rapid
 * pings can't double-send. One row here covers every student at the stop
 * (student_id left null) since it's a dedup/audit marker, not a per-
 * recipient row — each parent still gets their own message_logs row via
 * sendAndLogMessage below.
 */
export async function checkAndNotifyApproachingStops(input: {
  tripId: string;
  lat: number;
  lng: number;
  createdBy?: string | null;
}): Promise<ApproachingStopNotifyResult[]> {
  const supabase = await createClient();
  const { stops } = await getStopsForTrip(input.tripId);
  const results: ApproachingStopNotifyResult[] = [];

  const { data: trip } = await supabase
    .from("trips")
    .select("bus_id")
    .eq("id", input.tripId)
    .maybeSingle();

  for (const routeStop of stops) {
    const stop = routeStop.stop;
    if (stop.lat == null || stop.lng == null) continue;

    const distanceKm = haversineKm(
      { lat: input.lat, lng: input.lng },
      { lat: stop.lat, lng: stop.lng },
    );
    const etaMinutes = (distanceKm / ASSUMED_SPEED_KMH) * 60;
    if (etaMinutes > APPROACH_THRESHOLD_MINUTES) continue;

    // Atomic dedup: this insert only succeeds the first time for this
    // (trip_id, stop_id, kind) triple while status stays open/notified —
    // a unique-violation means we already alerted for this stop.
    const { data: alertRow, error: alertError } = await supabase
      .from("proximity_alerts")
      .insert({
        trip_id: input.tripId,
        stop_id: stop.id,
        bus_id: trip?.bus_id ?? null,
        kind: "approaching_stop",
        distance_m: distanceKm * 1000,
        threshold_m: THRESHOLD_M_EQUIVALENT,
        lat: input.lat,
        lng: input.lng,
        status: "notified",
        notified_at: new Date().toISOString(),
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();

    if (alertError) {
      if (alertError.code === "23505") continue; // already alerted for this stop
      console.error(
        `[approach-alert] failed to record alert for stop ${stop.id}:`,
        alertError.message,
      );
      continue;
    }
    if (!alertRow) continue;

    const { data: assignments } = await supabase
      .from("student_stop_assignments")
      .select(
        "student_id, students ( first_name, last_name ), student_parents ( is_primary, parents ( full_name, phone ) )",
      )
      .eq("stop_id", stop.id);

    let notified = 0;
    for (const row of assignments ?? []) {
      const student = firstOf(row.students as StudentRow | StudentRow[] | null);
      const parentLinks = (row.student_parents ?? []) as ParentLinkRow[];
      const primaryLink =
        parentLinks.find((p) => p.is_primary) ?? parentLinks[0] ?? null;
      const parent = firstOf(primaryLink?.parents ?? null);
      const phone = parent?.phone?.trim();
      if (!phone || !student) continue;

      const studentName = `${student.first_name} ${student.last_name}`.trim();
      const body = `Silverleaf Transport: the bus is about ${Math.max(
        1,
        Math.round(etaMinutes),
      )} min from ${stop.name} to pick up/drop off ${studentName}. Please be ready.`;

      try {
        await sendAndLogMessage({
          to: phone,
          body,
          studentId: row.student_id as string,
          templateKey: "approaching_stop",
          createdBy: input.createdBy ?? null,
        });
        notified++;
      } catch (err) {
        console.error(
          `[approach-alert] failed to notify parent for student ${row.student_id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    results.push({
      stop_id: stop.id,
      stop_name: stop.name,
      eta_minutes: etaMinutes,
      students_notified: notified,
    });
  }

  return results;
}

type StudentRow = { first_name: string; last_name: string };
type ParentLinkRow = {
  is_primary: boolean;
  parents: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
