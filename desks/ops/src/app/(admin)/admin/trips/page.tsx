import Link from "next/link";
import { getBuses, listTripsForReport } from "@/lib/db/queries";
import { sortByAlpha } from "@/lib/sort/alphabetical";
import type { TripWithBus } from "@/types/database";

const STATUS_LABEL: Record<TripWithBus["status"], string> = {
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<TripWithBus["status"], string> = {
  scheduled: "bg-light-blue-30 text-electric-blue",
  active: "bg-gold-15 text-gold",
  completed: "bg-light-blue-30/60 text-ink-muted",
  cancelled: "bg-danger-15 text-danger",
};

function formatClock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  });
}

export default async function TripHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    busId?: string;
    status?: string;
  }>;
}) {
  const { from, to, busId, status } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selectedFrom = from || today;
  const selectedTo = to || today;
  const selectedStatus =
    status && status in STATUS_LABEL ? (status as TripWithBus["status"]) : undefined;

  const [buses, trips] = await Promise.all([
    getBuses(),
    listTripsForReport({
      from: selectedFrom,
      to: selectedTo,
      busId: busId || undefined,
      status: selectedStatus,
    }),
  ]);

  // A trip that's still scheduled/active from a day before today is stuck
  // -- it was never closed out. Surface these clearly rather than letting
  // them blend in, since there was previously no way to see them at all.
  const staleOpenCount = trips.filter(
    (t) => (t.status === "scheduled" || t.status === "active") && t.trip_date < today,
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="ui-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Admin · Buses
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-electric-blue">
            Trips
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Every trip, any date — click a <strong>date</strong> to see the GPS
            path that bus drove.
          </p>
        </div>
      </div>

      {staleOpenCount > 0 ? (
        <div className="ui-rise ui-rise-delay-1 mt-6 rounded-[var(--radius)] border border-gold/40 bg-gold-15 p-4 text-sm text-ink">
          <strong className="font-bold">{staleOpenCount}</strong>{" "}
          {staleOpenCount === 1 ? "trip" : "trips"} shown below{" "}
          {staleOpenCount === 1 ? "is" : "are"} still scheduled/active from a
          past day -- it was never properly ended. These need a matron or
          admin to close them out.
        </div>
      ) : null}

      <form
        className="ui-rise ui-rise-delay-2 ui-panel mt-6 flex flex-wrap items-end gap-3 p-4"
        method="get"
      >
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={selectedFrom}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">To</span>
          <input
            type="date"
            name="to"
            defaultValue={selectedTo}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Bus</span>
          <select
            name="busId"
            defaultValue={busId ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All buses</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.plate_number})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Status
          </span>
          <select
            name="status"
            defaultValue={selectedStatus ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All statuses</option>
            {sortByAlpha(Object.entries(STATUS_LABEL), ([, label]) => label).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105"
        >
          Show
        </button>
      </form>

      {trips.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30/80 p-10 text-center text-sm text-ink-muted">
          No trips in this range.
        </div>
      ) : (
        <div className="ui-rise ui-rise-delay-3 mt-8 overflow-x-auto rounded-[var(--radius)] border border-card-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-light-blue-30/60 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Bus</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Ended</th>
                <th className="px-4 py-3">Scanned</th>
                <th className="px-4 py-3">Aboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {trips.map((t) => {
                const stale =
                  (t.status === "scheduled" || t.status === "active") &&
                  t.trip_date < today;
                return (
                  <tr
                    key={t.id}
                    className={`group ${stale ? "bg-gold-15/40" : "hover:bg-light-blue-30/50"}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      <Link
                        href={`/admin/trips/${t.id}`}
                        className="font-semibold text-electric-blue underline-offset-2 hover:underline"
                      >
                        {t.trip_date}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/trips/${t.id}`}
                        className="font-semibold text-ink no-underline group-hover:text-electric-blue"
                      >
                        {t.bus_label}{" "}
                        <span className="font-normal text-ink-faint">
                          ({t.bus_plate})
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 uppercase">{t.direction}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                        {stale ? " · stuck open" : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {formatClock(t.started_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {formatClock(t.ended_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {t.students_scanned}
                      {t.roster_on_bus > 0 ? (
                        <span className="text-ink-faint">
                          {" "}
                          / {t.roster_on_bus}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{t.aboard_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
