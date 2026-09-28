import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sortByAlpha } from "@/lib/sort/alphabetical";
import { addRouteStop, createBus, createRoute } from "./actions";

type RouteStopRow = {
  stop_order: number;
  stop: { id: string; name: string } | { id: string; name: string }[] | null;
};

function stopName(stop: RouteStopRow["stop"]): string {
  if (!stop) return "Stop";
  return Array.isArray(stop) ? (stop[0]?.name ?? "Stop") : stop.name;
}

export default async function FleetPage() {
  const supabase = await createClient();

  const [{ data: buses }, { data: routes }] = await Promise.all([
    supabase
      .from("buses")
      .select("id, plate_number, label, capacity, route_id, active")
      .order("label", { ascending: true }),
    supabase
      .from("routes")
      .select(
        "id, name, direction, active, route_stops(stop_order, stop:stops(id, name))",
      )
      .order("name", { ascending: true }),
  ]);

  const busesByRoute = new Map<string, string[]>();
  for (const bus of buses ?? []) {
    if (!bus.route_id) continue;
    const list = busesByRoute.get(bus.route_id) ?? [];
    list.push(bus.plate_number);
    busesByRoute.set(bus.route_id, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-5 sm:px-6 lg:max-w-4xl">
      <div className="ui-rise">
        <Link
          href="/matron/more"
          className="text-sm font-bold text-electric-blue no-underline hover:underline"
        >
          ← Back to More
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-light-blue">
          Setup · occasional use
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-electric-blue">
          Fleet setup
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Add a bus, route, or stop when ops asks. Day-to-day duty stays on Home
          · Scan · Roster — this page is for setup only.
        </p>
      </div>

      <section className="ui-rise ui-rise-delay-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-electric-blue">Buses</h2>
          <span className="text-xs font-semibold text-ink-faint">
            {(buses ?? []).length} registered
          </span>
        </div>

        <form
          action={createBus}
          className="mt-3 space-y-3 rounded-[1.1rem] border border-card-border bg-white/90 p-4 shadow-[var(--shadow)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Add a bus
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="min-w-[180px] flex-1 text-xs font-semibold text-ink-muted">
              Plate number
              <input
                name="plate_number"
                required
                placeholder="e.g. T 123 ABC"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue"
              />
            </label>
            <label className="min-w-[140px] flex-1 text-xs font-semibold text-ink-muted">
              Label
              <input
                name="label"
                placeholder="Optional nickname"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue"
              />
            </label>
            <label className="w-full text-xs font-semibold text-ink-muted sm:w-28">
              Seats
              <input
                name="capacity"
                type="number"
                min="1"
                placeholder="40"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue"
              />
            </label>
          </div>
          <button type="submit" className="ui-cta sm:w-auto sm:min-w-[10rem] sm:px-6">
            Add bus
          </button>
        </form>

        <ul className="mt-4 divide-y divide-card-border overflow-hidden rounded-[1.1rem] border border-card-border bg-white/90 shadow-[var(--shadow)]">
          {(buses ?? []).map((bus) => (
            <li
              key={bus.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="font-extrabold text-ink">{bus.plate_number}</span>
              <span className="text-right text-ink-muted">
                {bus.label ?? "—"}
                {bus.capacity ? ` · ${bus.capacity} seats` : ""}
              </span>
            </li>
          ))}
          {(buses ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No buses yet.
            </li>
          )}
        </ul>
      </section>

      <section className="ui-rise ui-rise-delay-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-electric-blue">Routes</h2>
          <span className="text-xs font-semibold text-ink-faint">
            {(routes ?? []).length} routes
          </span>
        </div>

        <form
          action={createRoute}
          className="mt-3 space-y-3 rounded-[1.1rem] border border-card-border bg-white/90 p-4 shadow-[var(--shadow)]"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Add a route
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="min-w-[180px] flex-1 text-xs font-semibold text-ink-muted">
              Route name
              <input
                name="name"
                required
                placeholder="e.g. Kariakoo AM"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue"
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Direction
              <select
                name="direction"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue sm:w-auto"
                defaultValue="am"
              >
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </label>
            <label className="min-w-[160px] flex-1 text-xs font-semibold text-ink-muted">
              Assign bus
              <select
                name="bus_id"
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-electric-blue"
                defaultValue=""
              >
                <option value="">Optional</option>
                {sortByAlpha(buses ?? [], (bus) => bus.label || bus.plate_number).map(
                  (bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.label || bus.plate_number}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <button type="submit" className="ui-cta sm:w-auto sm:min-w-[10rem] sm:px-6">
            Add route
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-4">
          {(routes ?? []).map((route) => {
            const plates = busesByRoute.get(route.id) ?? [];
            const stops = ((route.route_stops ?? []) as RouteStopRow[])
              .slice()
              .sort((a, b) => a.stop_order - b.stop_order);

            return (
              <div
                key={route.id}
                className="rounded-[1.1rem] border border-card-border bg-white/90 p-4 shadow-[var(--shadow)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-electric-blue">
                      {route.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {String(route.direction).toUpperCase()}
                      {plates.length
                        ? ` · Bus ${plates.join(", ")}`
                        : " · No bus assigned"}
                    </p>
                  </div>
                  <span className="rounded-full bg-light-blue-30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-electric-blue">
                    {stops.length} stops
                  </span>
                </div>

                <ol className="mt-3 flex flex-col gap-2">
                  {stops.map((stop) => (
                    <li
                      key={`${route.id}-${stop.stop_order}-${stopName(stop.stop)}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-light-blue-30/80 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-ink">
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-electric-blue text-[10px] font-bold text-white">
                          {stop.stop_order + 1}
                        </span>
                        {stopName(stop.stop)}
                      </span>
                    </li>
                  ))}
                  {stops.length === 0 && (
                    <li className="text-sm text-ink-faint">No stops yet.</li>
                  )}
                </ol>

                <form
                  action={addRouteStop}
                  className="mt-3 flex flex-col gap-2 border-t border-card-border/70 pt-3 sm:flex-row sm:items-end"
                >
                  <input type="hidden" name="route_id" value={route.id} />
                  <label className="min-w-0 flex-1 text-xs font-semibold text-ink-muted">
                    New stop
                    <input
                      name="name"
                      required
                      placeholder="Stop name"
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-sm text-ink outline-none focus:border-electric-blue"
                    />
                  </label>
                  <label className="w-full text-xs font-semibold text-ink-muted sm:w-28">
                    Order
                    <input
                      name="sequence"
                      type="number"
                      min="0"
                      placeholder="Auto"
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-sm text-ink outline-none focus:border-electric-blue"
                    />
                  </label>
                  <button
                    type="submit"
                    className="min-h-10 rounded-[var(--radius-sm)] border border-electric-blue/25 bg-electric-blue/5 px-4 text-sm font-bold text-electric-blue"
                  >
                    Add stop
                  </button>
                </form>
              </div>
            );
          })}
          {(routes ?? []).length === 0 && (
            <p className="rounded-[var(--radius)] border border-dashed border-card-border bg-white/60 px-4 py-6 text-center text-sm text-ink-muted">
              No routes yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
