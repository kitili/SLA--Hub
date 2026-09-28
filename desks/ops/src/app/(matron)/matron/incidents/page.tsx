import { createClient } from "@/lib/supabase/server";
import {
  ReportIncidentForm,
  type IncidentTripOption,
} from "@/components/matron/ReportIncidentForm";

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success-15 text-success border-success/20",
  medium: "bg-gold-15 text-electric-blue border-gold/30",
  high: "bg-danger-15 text-danger border-danger/25",
};

const TYPE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  delay: "Delay",
  medical: "Medical",
  behavior: "Behavior",
  other: "Other",
};

function tripLabel(trip: {
  trip_date: string;
  direction: string;
  status: string;
  bus: unknown;
}): string {
  const bus = Array.isArray(trip.bus) ? trip.bus[0] : trip.bus;
  const plate =
    (bus as { label?: string; plate_number?: string } | null)?.label ??
    (bus as { plate_number?: string } | null)?.plate_number ??
    "Bus";
  return `${plate} · ${trip.trip_date} ${String(trip.direction).toUpperCase()} (${trip.status})`;
}

export default async function IncidentsPage() {
  const supabase = await createClient();

  const [{ data: trips }, { data: incidents }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_date, direction, status, bus:buses(plate_number, label)")
      .order("trip_date", { ascending: false })
      .limit(80),
    supabase
      .from("incidents")
      .select(
        "id, trip_id, type, severity, notes, created_at, trip:trips(bus:buses(plate_number, label), trip_date, direction)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const allTrips = trips ?? [];
  const activeTrips: IncidentTripOption[] = allTrips
    .filter((t) => t.status === "active" || t.status === "scheduled")
    .map((trip) => ({
      id: trip.id,
      label: tripLabel(trip),
      status: trip.status,
    }));

  const recentTrips: IncidentTripOption[] = allTrips.map((trip) => ({
    id: trip.id,
    label: tripLabel(trip),
    status: trip.status,
  }));

  // Group history by calendar day for easier scanning
  const byDay = new Map<string, NonNullable<typeof incidents>>();
  for (const incident of incidents ?? []) {
    const day = new Date(incident.created_at).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const list = byDay.get(day) ?? [];
    list.push(incident);
    byDay.set(day, list);
  }

  return (
    <main className="matron-page">
      <header className="mb-5">
        <p className="matron-kicker">Report</p>
        <h1 className="matron-title mt-1">Incident</h1>
        <p className="mt-2 text-sm text-ink-muted">
          File a safety issue during the trip, or use Late log after the run.
        </p>
      </header>

      <section className="matron-surface p-4 sm:p-5">
        <ReportIncidentForm
          activeTrips={activeTrips}
          recentTrips={recentTrips}
        />
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="matron-kicker">History</p>
            <h2 className="mt-1 text-lg font-bold text-electric-blue">
              Recent reports
            </h2>
          </div>
          <span className="text-xs font-semibold text-ink-faint">
            {(incidents ?? []).length} shown
          </span>
        </div>

        <div className="mt-4 space-y-6">
          {[...byDay.entries()].map(([day, dayIncidents]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                {day}
              </p>
              <div className="flex flex-col gap-2.5">
                {dayIncidents.map((incident) => {
                  const trip = Array.isArray(incident.trip)
                    ? incident.trip[0]
                    : incident.trip;
                  const busRaw = trip && "bus" in trip ? trip.bus : null;
                  const bus = Array.isArray(busRaw) ? busRaw[0] : busRaw;
                  const busLabel = bus?.label ?? bus?.plate_number;
                  const isLate = Boolean(
                    incident.notes?.startsWith("[Late log"),
                  );

                  return (
                    <article
                      key={incident.id}
                      className="matron-surface p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                            SEVERITY_STYLES[incident.severity] ??
                            "border-card-border bg-light-blue-30 text-ink"
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span className="text-sm font-extrabold text-ink">
                          {TYPE_LABELS[incident.type] ?? incident.type}
                        </span>
                        {isLate ? (
                          <span className="rounded-full bg-light-blue-30 px-2 py-0.5 text-[10px] font-bold uppercase text-electric-blue">
                            Late log
                          </span>
                        ) : null}
                        {busLabel ? (
                          <span className="text-xs font-semibold text-ink-faint">
                            · {busLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {incident.notes || "No notes"}
                      </p>
                      <p className="mt-2 text-xs text-ink-faint">
                        {new Date(incident.created_at).toLocaleString()}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
          {(incidents ?? []).length === 0 ? (
            <p className="rounded-[1.1rem] border border-dashed border-card-border bg-white/60 px-4 py-10 text-center text-sm text-ink-muted">
              No incidents yet — that&apos;s a good morning.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
