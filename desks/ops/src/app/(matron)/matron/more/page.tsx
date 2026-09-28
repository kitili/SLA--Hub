import Link from "next/link";
import {
  TodayTripDayLog,
  type DayTripSummary,
} from "@/components/matron/TodayTripDayLog";
import { InstallMatronAppBanner } from "@/components/matron/InstallMatronAppBanner";
import { getSchoolToday } from "@/lib/date/schoolDate";
import { createClient } from "@/lib/supabase/server";

type BusRow = {
  id: string;
  plate_number: string;
  label: string | null;
  capacity: number | null;
  route_id: string | null;
  active: boolean | null;
  driver_name?: string | null;
  attendant_name?: string | null;
};

type RouteRow = {
  id: string;
  name: string;
  direction: string;
};

export default async function MatronMorePage() {
  const supabase = await createClient();
  const tripDate = getSchoolToday();

  const [{ data: buses }, { data: routes }, { data: dayTrips }] =
    await Promise.all([
      supabase
        .from("buses")
        .select(
          "id, plate_number, label, capacity, route_id, active, driver_name, attendant_name",
        )
        .eq("active", true)
        .order("label", { ascending: true }),
      supabase
        .from("routes")
        .select("id, name, direction")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("trips")
        .select(
          "id, direction, status, started_at, departed_school_at, ended_at, matron_id, bus:buses(label, plate_number)",
        )
        .eq("trip_date", tripDate)
        .order("started_at", { ascending: true }),
    ]);

  const tripIds = (dayTrips ?? []).map((t) => t.id);
  const matronIds = [
    ...new Set(
      (dayTrips ?? [])
        .map((t) => t.matron_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const matronNameById = new Map<string, string>();
  if (matronIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", matronIds);
    for (const p of profiles ?? []) {
      if (p.full_name) matronNameById.set(p.id, p.full_name);
    }
  }

  const lastPingByTrip = new Map<string, string>();
  if (tripIds.length > 0) {
    const { data: locs } = await supabase
      .from("trip_locations")
      .select("trip_id, recorded_at")
      .in("trip_id", tripIds)
      .order("recorded_at", { ascending: false });
    for (const loc of locs ?? []) {
      if (!lastPingByTrip.has(loc.trip_id)) {
        lastPingByTrip.set(loc.trip_id, loc.recorded_at);
      }
    }
  }

  const daySummaries: DayTripSummary[] = (dayTrips ?? []).map((trip) => {
    const bus = Array.isArray(trip.bus) ? trip.bus[0] : trip.bus;
    return {
      id: trip.id,
      bus_label: bus?.label ?? bus?.plate_number ?? "Bus",
      bus_plate: bus?.plate_number ?? "",
      direction: trip.direction,
      status: trip.status,
      started_at: trip.started_at,
      departed_school_at: trip.departed_school_at,
      ended_at: trip.ended_at,
      last_ping_at: lastPingByTrip.get(trip.id) ?? null,
      matron_name: trip.matron_id
        ? (matronNameById.get(trip.matron_id) ?? null)
        : null,
    };
  });

  const routeById = new Map(
    ((routes ?? []) as RouteRow[]).map((r) => [r.id, r]),
  );
  const busList = (buses ?? []) as BusRow[];
  const withRoute = busList.filter((b) => b.route_id).length;

  const tools = [
    {
      href: "/matron/students/print",
      title: "Print QR sheets",
      hint: "Paper codes for the demo or for kids without phones",
      accent: "gold" as const,
    },
    {
      href: "/matron/students",
      title: "Full roster",
      hint: "All students · filter by class, bus, school",
      accent: "blue" as const,
    },
    {
      href: "/matron/incidents",
      title: "Report incident",
      hint: "Active trip or late day/time log",
      accent: "blue" as const,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-5 sm:px-6 lg:max-w-4xl lg:py-8">
      <div className="ui-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-light-blue">
          Tools &amp; reference
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-electric-blue">
          More
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Day start/stop for every bus, print sheets, roster filters, and setup
          when you need it.
        </p>
      </div>

      <div className="ui-rise mt-5">
        <InstallMatronAppBanner />
      </div>

      <TodayTripDayLog trips={daySummaries} tripDate={tripDate} />

      <section className="ui-rise ui-rise-delay-1 mt-8">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          Quick tools
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className={`group flex h-full flex-col rounded-[1.1rem] border p-4 no-underline shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] ${
                  tool.accent === "gold"
                    ? "border-gold/40 bg-gradient-to-br from-gold/25 to-white"
                    : tool.accent === "blue"
                      ? "border-electric-blue/15 bg-white/90"
                      : "border-card-border bg-white/70"
                }`}
              >
                <span className="text-base font-extrabold text-electric-blue group-hover:underline">
                  {tool.title}
                </span>
                <span className="mt-1 text-sm leading-snug text-ink-muted">
                  {tool.hint}
                </span>
                <span className="mt-3 text-xs font-bold text-light-blue">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="ui-rise ui-rise-delay-2 mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Fleet at a glance
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-electric-blue">
              Today&apos;s buses
            </h2>
          </div>
          <p className="text-xs font-semibold text-ink-faint">
            {withRoute}/{busList.length} with a route
          </p>
        </div>

        {busList.length === 0 ? (
          <p className="mt-4 rounded-[var(--radius)] border border-dashed border-card-border bg-white/60 px-4 py-8 text-center text-sm text-ink-muted">
            No active buses loaded. Ask ops to run the Silverleaf seed.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-card-border/80 overflow-hidden rounded-[1.1rem] border border-card-border bg-white/90 shadow-[var(--shadow)]">
            {busList.map((bus) => {
              const route = bus.route_id
                ? routeById.get(bus.route_id)
                : undefined;
              const title = bus.label?.trim() || bus.plate_number;
              const plateDistinct =
                bus.plate_number &&
                bus.plate_number !== bus.label &&
                bus.plate_number !== "TBA";

              return (
                <li key={bus.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-ink">{title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {plateDistinct ? `${bus.plate_number} · ` : null}
                        {bus.capacity ? `${bus.capacity} seats` : "Capacity —"}
                        {bus.driver_name ? ` · Driver ${bus.driver_name}` : null}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        route
                          ? "bg-success-15 text-success"
                          : "bg-gold-15 text-ink"
                      }`}
                    >
                      {route ? route.direction.toUpperCase() : "No route"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-electric-blue">
                    {route?.name ?? "Route not assigned yet"}
                  </p>
                  {bus.attendant_name ? (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Attendant · {bus.attendant_name}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ui-rise ui-rise-delay-3 mt-8 rounded-[1.1rem] border border-electric-blue/15 bg-gradient-to-br from-electric-blue/[0.06] to-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-light-blue">
          Duty tips
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-muted">
          <li>
            <span className="font-bold text-ink">Home → Scan</span> boards
            students. <span className="font-bold text-ink">Path</span> is GPS
            navigation. One phone does the whole trip.
          </li>
          <li>
            Keep Scan or Path open during the trip so GPS pings to admin Live
            map (offline pings queue and send when data returns).
          </li>
          <li>
            On board now shows students aboard / seats on the bus (capacity),
            not roster size.
          </li>
        </ul>
      </section>
    </main>
  );
}
