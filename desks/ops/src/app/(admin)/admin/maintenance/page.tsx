import { getBuses, getSchools } from "@/lib/db/queries";
import { listExpenses } from "@/lib/db/finance";
import { listMaintenance } from "@/lib/db/maintenance";
import { MaintenanceClient } from "@/components/maintenance/MaintenanceClient";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function MaintenancePage() {
  const [buses, records, expenses, schools] = await Promise.all([
    getBuses(),
    listMaintenance(),
    listExpenses(),
    getSchools(),
  ]);

  const busOptions = buses.map((b) => ({
    id: b.id,
    label: b.label,
    plate_number: b.plate_number,
    school_id: b.school_id,
  }));

  const expenseOptions = expenses.map((e) => ({
    id: e.id,
    bus_id: e.bus_id,
    title: e.title,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    spent_on: e.spent_on,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
            Admin · Fleet
          </p>
          <h1 className="mt-1 text-2xl font-bold text-electric-blue">
            Repair and Maintenance
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Log a repair/service job and optionally create or link its{" "}
            <code>createExpense</code> / <code>expenseId</code> finance expense in
            one step.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton entity="maintenance" />
          <ImportCsvPanel
            entity="maintenance"
            columnsHelpText="Required columns: bus, title. Optional: category, status, cost, budget_amount, currency, service_date, due_date, notes."
          />
        </div>
      </div>

      <div className="mt-6">
        <MaintenanceClient
          buses={busOptions}
          initialRecords={records}
          expenses={expenseOptions}
          schools={schools}
        />
      </div>
    </main>
  );
}
