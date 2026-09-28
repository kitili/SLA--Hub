import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBusById,
  getLatestTripLocation,
  getRouteStops,
  getTripRoster,
  getTrips,
} from "@/lib/db/queries";
import { getRouteById } from "@/lib/db/routes";
import { listExpenses, listHireOuts, listRevenues } from "@/lib/db/finance";
import { getDriverById } from "@/lib/db/drivers";
import { listMaintenance } from "@/lib/db/maintenance";
import { formatCoords } from "@/lib/geo/format";
import { OccupancyMeter } from "@/components/fleet/OccupancyAlarm";
import {
  buildDriverCompliance,
  buildInsuranceCompliance,
  type ComplianceStatus,
} from "@/lib/compliance/driver-compliance";
import { pickWorst } from "@/lib/compliance/expiry-check";
import { buildMaintenanceDueCompliance } from "@/lib/compliance/maintenance-compliance";
import type { TripStatus } from "@/types/database";

const COMPLIANCE_STYLES: Record<ComplianceStatus, string> = {
  ok: "bg-success-15 text-success",
  expiring_soon: "bg-gold-15 text-ink",
  expired: "bg-danger-15 text-danger",
  missing: "bg-light-blue-30 text-ink-muted",
};

function sumByCategory<T extends { category: string; amount: number }>(
  records: T[],
): { category: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const record of records) {
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount);
  }
  return Array.from(totals, ([category, total]) => ({ category, total }));
}

function minutesAgo(isoString: string): string {
  const minutes = Math.round(
    (Date.now() - new Date(isoString).getTime()) / 60000,
  );
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_STYLES: Record<TripStatus, string> = {
  scheduled: "bg-light-blue-30 text-electric-blue",
  active: "bg-success-15 text-success",
  completed: "bg-card text-ink-muted",
  cancelled: "bg-danger-15 text-danger",
};

const DIRECTION_STYLES = {
  am: "bg-light-blue-30 text-electric-blue",
  pm: "bg-card text-ink-muted",
};

export default async function BusDetailPage({ params }: Props) {
  const { id } = await params;
  const [bus, trips] = await Promise.all([getBusById(id), getTrips()]);

  if (!bus) {
    notFound();
  }

  const [route, routeStops] = bus.route_id
    ? await Promise.all([
        getRouteById(bus.route_id),
        getRouteStops(bus.route_id),
      ])
    : [null, { routeName: null, stops: [] }];

  const busTrips = trips.filter((trip) => trip.bus_id === bus.id);
  const amTrip = busTrips.find((trip) => trip.direction === "am") ?? null;
  const pmTrip = busTrips.find((trip) => trip.direction === "pm") ?? null;
  const overfillTrips = busTrips.filter(
    (t) =>
      (t.status === "active" || t.status === "scheduled") &&
      t.aboard_count > bus.capacity,
  );

  const [amLocation, pmLocation, amRoster, pmRoster] = await Promise.all([
    amTrip ? getLatestTripLocation(amTrip.id) : Promise.resolve(null),
    pmTrip ? getLatestTripLocation(pmTrip.id) : Promise.resolve(null),
    amTrip ? getTripRoster(amTrip.id) : Promise.resolve([]),
    pmTrip ? getTripRoster(pmTrip.id) : Promise.resolve([]),
  ]);

  const [expenses, revenues, hireOuts, driver, maintenanceRecords] = await Promise.all([
    listExpenses({ busId: bus.id }),
    listRevenues({ busId: bus.id }),
    listHireOuts({ busId: bus.id }),
    bus.driver_id ? getDriverById(bus.driver_id) : Promise.resolve(null),
    listMaintenance(bus.id),
  ]);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const revenueTotal = revenues.reduce((sum, r) => sum + r.amount, 0);
  const expenseByCategory = sumByCategory(expenses);
  const revenueByCategory = sumByCategory(revenues);
  const driverCompliance = buildDriverCompliance(driver);
  const worstDriverCheck = pickWorst(driverCompliance.checks);
  const insuranceCompliance = buildInsuranceCompliance(bus.insurance_expiry ?? null);
  const openMaintenance = maintenanceRecords.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/admin/buses"
        className="text-sm font-semibold text-electric-blue no-underline"
      >
        ← Back to buses
      </Link>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Fleet · Bus detail
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">{bus.label}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {bus.plate_number} · {bus.active ? "Active" : "Inactive"}
          {bus.route_id ? (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/admin/routes/${bus.route_id}`}
                className="font-semibold text-electric-blue hover:underline"
              >
                Open route builder
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {overfillTrips.length > 0 ? (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm text-danger"
        >
          <p className="font-bold">Occupancy alarm</p>
          <p className="mt-1">
            {overfillTrips
              .map(
                (t) =>
                  `${t.direction.toUpperCase()} ${t.aboard_count}/${bus.capacity}`,
              )
              .join(" · ")}{" "}
            exceeds capacity.
          </p>
        </div>
      ) : null}

      <section className="mt-6 rounded-[var(--radius)] border border-card-border bg-light-blue-30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Capacity
        </p>
        <p className="mt-1 text-lg font-bold text-electric-blue">
          {bus.capacity} seats
        </p>
      </section>

      <section className="mt-4 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Crew
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Driver
            </p>
            <p className="mt-1 text-sm text-ink">{bus.driver_name ?? "Not assigned"}</p>
            {worstDriverCheck ? (
              <span
                className={`mt-2 inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STYLES[worstDriverCheck.check.status]}`}
              >
                {worstDriverCheck.check.note}
              </span>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Attendant
            </p>
            <p className="mt-1 text-sm text-ink">{bus.attendant_name ?? "Not assigned"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Owner
            </p>
            <p className="mt-1 text-sm text-ink">{bus.owner_name ?? "Not specified"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Insurance
            </p>
            <span
              className={`mt-1 inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STYLES[insuranceCompliance.status]}`}
            >
              {insuranceCompliance.note}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Maintenance
        </h2>
        {openMaintenance.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">No open maintenance records.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {openMaintenance.map((record) => {
              const dueCompliance = buildMaintenanceDueCompliance(record);
              return (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-card-border p-3"
                >
                  <span className="text-sm font-semibold text-ink">{record.title}</span>
                  {dueCompliance ? (
                    <span
                      className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STYLES[dueCompliance.status]}`}
                    >
                      {dueCompliance.note}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Today&apos;s trips
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { label: "AM", trip: amTrip, location: amLocation, roster: amRoster },
              { label: "PM", trip: pmTrip, location: pmLocation, roster: pmRoster },
            ] as const
          ).map(({ label, trip, location, roster }) => (
            <div
              key={label}
              className="rounded-[var(--radius-sm)] border border-card-border p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label} trip
              </p>
              {trip ? (
                <>
                  <span
                    className={`mt-2 inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold uppercase ${STATUS_STYLES[trip.status]}`}
                  >
                    {trip.status}
                  </span>
                  <div className="mt-2">
                    <OccupancyMeter
                      aboard={trip.aboard_count}
                      capacity={bus.capacity}
                      compact
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {location
                      ? `Last ping: ${formatCoords(location.lat, location.lng)} · ${minutesAgo(location.recorded_at)}`
                      : "No location data yet"}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Roster
                  </p>
                  {roster.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-faint">No one aboard yet.</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {roster.map((student) => (
                        <li key={student.id} className="text-sm text-ink-muted">
                          {student.name}
                          {student.class_name ? ` · ${student.class_name}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">Not scheduled yet</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Route
        </h2>
        {route ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">{route.name}</p>
              <span
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold uppercase ${DIRECTION_STYLES[route.direction]}`}
              >
                {route.direction}
              </span>
            </div>
            <ol className="mt-3 flex flex-col gap-2">
              {routeStops.stops.map((stop) => (
                <li
                  key={stop.stop_id}
                  className="rounded-[var(--radius-sm)] bg-light-blue-30 px-3 py-2 text-sm font-semibold text-ink"
                >
                  {stop.stop_order}. {stop.stop.name}
                </li>
              ))}
              {routeStops.stops.length === 0 && (
                <li className="text-sm text-ink-faint">No stops added yet.</li>
              )}
            </ol>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">No route assigned yet.</p>
        )}
      </section>

      <section className="mt-4 rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Finance
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-sm)] border border-card-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Expenses
            </p>
            <p className="mt-1 text-lg font-bold text-danger">
              {expenseTotal.toLocaleString()} TZS
            </p>
            {expenseByCategory.map(({ category, total }) => (
              <p key={category} className="mt-1 text-xs text-ink-muted">
                {category.replace(/_/g, " ")}: {total.toLocaleString()}
              </p>
            ))}
          </div>
          <div className="rounded-[var(--radius-sm)] border border-card-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Revenue
            </p>
            <p className="mt-1 text-lg font-bold text-success">
              {revenueTotal.toLocaleString()} TZS
            </p>
            {revenueByCategory.map(({ category, total }) => (
              <p key={category} className="mt-1 text-xs text-ink-muted">
                {category.replace(/_/g, " ")}: {total.toLocaleString()}
              </p>
            ))}
          </div>
          <div className="rounded-[var(--radius-sm)] border border-card-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Net
            </p>
            <p
              className={`mt-1 text-lg font-bold ${revenueTotal - expenseTotal >= 0 ? "text-success" : "text-danger"}`}
            >
              {(revenueTotal - expenseTotal).toLocaleString()} TZS
            </p>
          </div>
        </div>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Hire-outs
        </h3>
        {hireOuts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">No hire-out bookings for this bus.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {hireOuts.map((hireOut) => (
              <li
                key={hireOut.id}
                className="rounded-[var(--radius-sm)] border border-card-border p-3 text-sm text-ink"
              >
                {hireOut.client_name} · {hireOut.purpose} ·{" "}
                {new Date(hireOut.start_at).toLocaleDateString()} –{" "}
                {new Date(hireOut.end_at).toLocaleDateString()} ·{" "}
                <span className="uppercase text-ink-muted">{hireOut.status}</span> ·{" "}
                {hireOut.quoted_amount.toLocaleString()} {hireOut.currency}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
