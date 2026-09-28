import Link from "next/link";
import { getBuses, getSchools, getTrips } from "@/lib/db/queries";
import { getDrivers } from "@/lib/db/drivers";
import { listRoutes } from "@/lib/db/routes";
import {
  OccupancyAlarmBanner,
  OccupancyMeter,
  buildOccupancyRows,
} from "@/components/fleet/OccupancyAlarm";
import { FleetAdminForms } from "@/components/fleet/FleetAdminForms";
import { BusRowActions } from "@/components/fleet/BusRowActions";
import { CampusHeaderActions } from "@/components/fleet/CampusHeaderActions";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function BusesPage() {
  const [buses, trips, routes, schools, drivers] = await Promise.all([
    getBuses(),
    getTrips(),
    listRoutes(),
    getSchools(),
    getDrivers(),
  ]);
  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.name }));
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const capacityByBusId = new Map(buses.map((b) => [b.id, b.capacity]));
  const occupancyRows = buildOccupancyRows(trips, capacityByBusId);
  const busesBySchool = new Map<string, typeof buses>();
  for (const bus of buses) {
    const list = busesBySchool.get(bus.school_id) ?? [];
    list.push(bus);
    busesBySchool.set(bus.school_id, list);
  }
  const campuses = schools
    .map((school) => ({ school, buses: busesBySchool.get(school.id) ?? [] }))
    .filter((campus) => campus.buses.length > 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
            Admin · Fleet
          </p>
          <h1 className="mt-1 text-2xl font-bold text-electric-blue">Buses & trips</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Jfree owns this page — fleet list, morning/evening trips, and occupancy alarms.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton entity="buses" />
          <ImportCsvPanel
            entity="buses"
            columnsHelpText="Required columns: school (slug or name), label, plate_number. Optional: capacity, driver_name, attendant_name, owner_name. Matches existing buses by (school, label)."
          />
        </div>
      </div>

      <FleetAdminForms
        schools={schools.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        drivers={driverOptions}
        routes={routes.map((r) => ({
          id: r.id,
          name: r.name,
          direction: r.direction,
          school_id: r.school_id,
        }))}
      />

      <div className="mt-6">
        <OccupancyAlarmBanner rows={occupancyRows} />
      </div>

      {buses.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
          No buses loaded. Ask Kai to run <code>seed.sql</code> in Supabase.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {campuses.map(({ school, buses: campusBuses }) => {
            const totalCapacity = campusBuses.reduce(
              (sum, bus) => sum + bus.capacity,
              0,
            );
            return (
              <div key={school.id}>
                <CampusHeaderActions
                  school={school}
                  busCount={campusBuses.length}
                  seatTotal={totalCapacity}
                />
                <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
                  {campusBuses.map((bus) => (
                    <li key={bus.id} className="p-4">
                      <BusRowActions
                        bus={bus}
                        schools={schools.map((s) => ({
                          id: s.id,
                          name: s.name,
                          slug: s.slug,
                        }))}
                        drivers={driverOptions}
                        routes={routes.map((r) => ({
                          id: r.id,
                          name: r.name,
                          direction: r.direction,
                          school_id: r.school_id,
                        }))}
                        routeLabel={
                          bus.route_id
                            ? (routesById.get(bus.route_id)?.name ?? "Route unavailable")
                            : "No route assigned"
                        }
                        trips={trips.filter((trip) => trip.bus_id === bus.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold text-electric-blue">Today&apos;s trips</h2>
        {trips.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No trips yet — use AM/PM trip on a bus above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card">
            {trips.map((trip) => {
              const capacity =
                buses.find((bus) => bus.id === trip.bus_id)?.capacity ?? 0;
              const over = capacity > 0 && trip.aboard_count > capacity;
              return (
                <li
                  key={trip.id}
                  className={`px-4 py-3 text-sm text-ink ${
                    over ? "bg-danger-15" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/admin/trips/${trip.id}`}
                        className="font-semibold hover:text-electric-blue hover:underline"
                      >
                        {trip.bus_label}
                      </Link>{" "}
                      ({trip.bus_plate}) ·{" "}
                      <span className="font-semibold uppercase">
                        {trip.direction}
                      </span>{" "}
                      · {trip.status}
                      {over ? (
                        <span className="ml-2 text-xs font-bold uppercase text-danger">
                          Over capacity
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold tabular-nums text-electric-blue">
                        {trip.students_scanned}
                        {trip.roster_on_bus > 0
                          ? ` / ${trip.roster_on_bus}`
                          : ""}{" "}
                        scanned
                      </p>
                      <OccupancyMeter
                        aboard={trip.aboard_count}
                        capacity={capacity}
                        compact
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
