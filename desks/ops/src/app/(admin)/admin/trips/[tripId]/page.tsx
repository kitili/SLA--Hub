import Link from "next/link";
import { notFound } from "next/navigation";
import { TripDetailTrailSection } from "@/components/maps/TripDetailTrailSection";
import { createClient } from "@/lib/supabase/server";
import {
  getTripById,
  getTripDriverName,
  getTripScanStats,
  listBoardingEventsForTrip,
  listIncidentsForTrip,
} from "@/lib/db/queries";

function formatClock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
    hour12: false,
  });
}

function formatScanTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
    hour12: false,
  });
}

function scanPercent(scanned: number, roster: number) {
  if (roster <= 0) return null;
  return Math.round((scanned / roster) * 100);
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success-15 text-success",
  medium: "bg-gold-15 text-electric-blue",
  high: "bg-danger-15 text-danger",
};

const TYPE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  delay: "Delay",
  medical: "Medical",
  behavior: "Behavior",
  other: "Other",
  overload: "Bus overloaded",
  incomplete_roster: "Roster incomplete",
  unlisted_child: "Unlisted child",
};

type Props = {
  params: Promise<{ tripId: string }>;
};

export default async function AdminTripDetailPage({ params }: Props) {
  const { tripId } = await params;
  const [trip, scan, scans, driverName, incidents] = await Promise.all([
    getTripById(tripId),
    getTripScanStats(tripId),
    listBoardingEventsForTrip(tripId),
    getTripDriverName(tripId),
    listIncidentsForTrip(tripId),
  ]);
  if (!trip) notFound();

  const supabase = await createClient();
  let matronName: string | null = null;
  if (trip.matron_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", trip.matron_id)
      .maybeSingle();
    matronName = profile?.full_name ?? null;
  }

  const uniqueScanned = scan?.uniqueStudentsScanned ?? trip.students_scanned;
  const roster = scan?.rosterOnBus ?? trip.roster_on_bus;
  const pct = scanPercent(uniqueScanned, roster);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/admin/trips"
        className="text-sm font-semibold text-electric-blue no-underline hover:underline"
      >
        ← Back to trip history
      </Link>

      <div className="ui-rise mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Admin · Trip
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-electric-blue">
          {trip.bus_label}{" "}
          <span className="text-ink-faint">({trip.bus_plate})</span>
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {trip.trip_date} · {trip.direction.toUpperCase()} · {trip.status}
        </p>
      </div>

      <dl className="ui-rise ui-rise-delay-1 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="ui-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Students scanned
          </dt>
          <dd className="mt-1 text-2xl font-extrabold tabular-nums text-electric-blue">
            {uniqueScanned}
            {roster > 0 ? (
              <span className="text-base font-semibold text-ink-muted">
                {" "}
                / {roster}
                {pct != null ? ` · ${pct}%` : ""}
              </span>
            ) : null}
          </dd>
          <p className="mt-1 text-xs text-ink-faint">
            Unique children with a scan on this trip
          </p>
        </div>
        <div className="ui-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Total scans
          </dt>
          <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
            {scan?.totalScanEvents ?? scans.length}
          </dd>
          <p className="mt-1 text-xs text-ink-faint">Boarding events logged</p>
        </div>
        <div className="ui-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            On board (now)
          </dt>
          <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
            {scan?.aboardNow ?? trip.aboard_count}
            {trip.bus_capacity != null ? (
              <span className="text-base font-semibold text-ink-muted">
                {" "}
                / {trip.bus_capacity}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="ui-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Matron
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">
            {matronName ?? "—"}
          </dd>
          <p className="mt-2 text-xs text-ink-faint">
            Started {formatClock(trip.started_at)}
          </p>
          <p className="text-xs text-ink-faint">
            Ended {formatClock(trip.ended_at)}
          </p>
        </div>
        <div className="ui-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Driver
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">
            {driverName ?? <span className="font-normal text-ink-faint">Not on file</span>}
          </dd>
        </div>
      </dl>

      <section className="ui-rise ui-rise-delay-2 ui-panel mt-8 p-4">
        <h2 className="text-lg font-bold text-electric-blue">Route driven</h2>
        <p className="mt-1 text-sm text-ink-muted">
          GPS path from matron pings during this trip.
        </p>
        <div className="mt-4">
          <TripDetailTrailSection tripId={trip.id} busLabel={trip.bus_label} />
        </div>
      </section>

      <section className="ui-rise ui-rise-delay-3 ui-panel mt-8 p-4">
        <h2 className="text-lg font-bold text-electric-blue">
          Incidents{incidents.length > 0 ? ` (${incidents.length})` : ""}
        </h2>
        {incidents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No incidents reported on this trip.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {incidents.map((incident) => (
              <li key={incident.id} className="ui-panel px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                      SEVERITY_STYLES[incident.severity] ?? "bg-gray text-ink"
                    }`}
                  >
                    {incident.severity}
                  </span>
                  <span className="text-xs font-semibold text-ink-muted">
                    {TYPE_LABELS[incident.type] ?? incident.type}
                  </span>
                  <span className="text-xs text-ink-faint">
                    · {formatClock(incident.created_at)}
                  </span>
                  {incident.reported_by_name ? (
                    <span className="text-xs text-ink-faint">
                      · reported by {incident.reported_by_name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-ink">
                  {incident.notes || "No notes"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-rise ui-rise-delay-4 ui-panel mt-8 p-4">
        <h2 className="text-lg font-bold text-electric-blue">Scan log</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Chronological boarding events for this trip.
        </p>
        {scans.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No scans recorded yet.</p>
        ) : (
          <ul className="mt-4 max-h-80 divide-y divide-card-border overflow-y-auto rounded-[var(--radius-sm)] border border-card-border">
            {scans.map((row) => (
              <li key={row.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{row.student_name}</span>
                  <span className="text-xs text-ink-muted">
                    {row.class_name ?? "—"} · {row.event_type.toUpperCase()} ·{" "}
                    {formatScanTime(row.scanned_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {row.stop_name ? `Boarded near ${row.stop_name}` : null}
                  {row.stop_name && row.lat != null ? " · " : ""}
                  {row.lat != null && row.lng != null
                    ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
                    : row.stop_name
                      ? ""
                      : "No GPS data for this scan"}
                  {row.location_source === "trail" ? " (from bus GPS trail)" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
