import Link from "next/link";
import { getBuses, listBoardingEventsForReport, getSchools, getStudents } from "@/lib/db/queries";
import { getPeriodPnL } from "@/lib/db/finance";
import { listRoutes, listAllRouteStopsForExport } from "@/lib/db/routes";
import { getBusesWithCompliance } from "@/lib/db/drivers";
import { listMaintenance } from "@/lib/db/maintenance";
import { buildBusCompliance } from "@/lib/compliance/driver-compliance";
import { flagMaintenanceRecords } from "@/lib/compliance/maintenance-compliance";
import { CAMPUS_SHEET } from "@/lib/dashboard/campus-sheet";
import { computeFleetOccupancyPct } from "@/lib/dashboard/occupancy";
import { computeFleetDistanceKm } from "@/lib/dashboard/cost-metrics";
import { BusesOnlineWidget } from "@/components/admin/BusesOnlineWidget";
import { KmOptimizeCard } from "@/components/admin/KmOptimizeCard";
import { CampusOccupancyChart } from "@/components/charts/CampusOccupancyChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { FinancePnLPanel } from "@/components/finance/FinancePnLPanel";

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

function dayOffsetIso(daysBack: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  const { from, to } = monthBounds();
  const trendDates = Array.from({ length: 7 }, (_, i) => dayOffsetIso(6 - i));

  const [
    students,
    buses,
    schools,
    routes,
    pnl,
    busesWithCompliance,
    maintenanceRecords,
    routeStopRows,
    ...boardingDays
  ] = await Promise.all([
    getStudents(),
    getBuses(),
    getSchools(),
    listRoutes(),
    getPeriodPnL({ from, to }),
    getBusesWithCompliance(),
    listMaintenance(),
    listAllRouteStopsForExport(),
    ...trendDates.map((date) => listBoardingEventsForReport({ from: date, to: date })),
  ]);

  // listAllRouteStopsForExport() returns every route's stops regardless of
  // active status (the CSV export legitimately wants that) -- filter to
  // active routes only here, since computeFleetDistanceKm is documented as
  // "active routes only" for the Cost per km tile.
  const activeRouteIds = new Set(routes.filter((r) => r.active).map((r) => r.id));
  const fleetDistanceKm = computeFleetDistanceKm(
    routeStopRows.filter((r) => activeRouteIds.has(r.route_id)),
  );

  const boardingTrend = trendDates.map((date, i) => {
    const day = boardingDays[i] ?? [];
    return {
      date,
      count: day.length,
      timeIn: day.filter((e) => e.event_type === "in").length,
      timeOut: day.filter((e) => e.event_type === "out").length,
    };
  });

  const flaggedBusCount = busesWithCompliance.filter(
    (b) => buildBusCompliance(b, b.driver).worst !== "ok",
  ).length;
  const flaggedMaintenanceCount = flagMaintenanceRecords(maintenanceRecords).length;
  const totalFlagged = flaggedBusCount + flaggedMaintenanceCount;

  const schoolBySlug = Object.fromEntries(schools.map((s) => [s.slug, s]));
  const capacityTotal = buses.reduce((s, b) => s + (b.capacity || 0), 0);
  const occupancyPct = computeFleetOccupancyPct(students.length, buses);

  const campusRows = CAMPUS_SHEET.map((campus) => {
    const school = schoolBySlug[campus.slug];
    return {
      name: campus.name,
      students: campus.studentsSheet,
      capacity: campus.capacitySheet,
      dbStudents: school
        ? students.filter((s) => s.school_id === school.id).length
        : 0,
      dbBuses: school
        ? buses.filter((b) => b.school_id === school.id).length
        : 0,
    };
  });

  const campusSlices = campusRows.map((c, i) => ({
    label: c.name,
    value: c.students,
    color: ["#002368", "#80bfec", "#ffc952", "#167a37", "#003a8c"][i % 5]!,
  }));
  const campusTotal = campusSlices.reduce((s, x) => s + x.value, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="ui-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Admin · Silverleaf transport
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-electric-blue">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Analytics view — fleet pulse, boarding traffic, and period P&amp;L.
          </p>
        </div>
      </div>

      {totalFlagged > 0 ? (
        <Link
          href="/admin/alerts"
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm font-semibold text-danger no-underline hover:opacity-90"
        >
          {totalFlagged} fleet compliance issue{totalFlagged === 1 ? "" : "s"} need
          attention → View alerts
        </Link>
      ) : null}

      <FinancePnLPanel
        initialPnL={pnl}
        boardingTrend={boardingTrend}
        defaultFrom={from}
        defaultTo={to}
        schools={schools.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        fleetDistanceKm={fleetDistanceKm}
        totalStudents={students.length}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CampusOccupancyChart campuses={campusRows} />
        </div>

        <article className="ui-panel p-5 lg:col-span-4">
          <h3 className="text-sm font-bold text-ink">Riders by campus</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Sheet roster mix · {campusTotal.toLocaleString()} riders
          </p>
          <div className="mt-4">
            <DonutChart
              slices={campusSlices}
              centerLabel="Riders"
              centerValue={campusTotal.toLocaleString()}
              formatValue={(n) => n.toLocaleString()}
              size={150}
            />
          </div>
        </article>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <article className="ui-panel flex-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Occupancy
            </p>
            <p className="mt-2 font-display text-3xl font-extrabold text-electric-blue">
              {occupancyPct}%
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {students.length.toLocaleString()} /{" "}
              {capacityTotal.toLocaleString()} seats
            </p>
          </article>
          <article className="ui-panel flex-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Campuses
            </p>
            <p className="mt-2 font-display text-3xl font-extrabold text-electric-blue">
              {schools.length || CAMPUS_SHEET.length}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Usariver · AM · Kijenge · Ilboru · Boma
            </p>
          </article>
          <KmOptimizeCard
            routes={routes.map((r) => ({
              id: r.id,
              name: r.name,
              direction: r.direction,
            }))}
          />
        </div>
      </div>

      <BusesOnlineWidget />
    </main>
  );
}
