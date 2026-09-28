import { getDriversWithPhotos } from "@/lib/db/drivers";
import { DriversClient } from "@/components/fleet/DriversClient";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function DriversPage() {
  const drivers = await getDriversWithPhotos();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
            Admin · Fleet
          </p>
          <h1 className="mt-1 text-2xl font-bold text-electric-blue">Drivers</h1>
          <p className="mt-2 text-sm text-ink-muted">
            License number and expiry per driver — assign a driver to a bus from{" "}
            <code className="text-xs">/admin/buses</code>. Admin-only.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton entity="drivers" />
          <ImportCsvPanel
            entity="drivers"
            columnsHelpText="Required column: name. Optional: license_number, license_expiry, phone. Matches existing drivers by license_number first, then name."
          />
        </div>
      </div>

      <DriversClient initialDrivers={drivers} />
    </main>
  );
}
