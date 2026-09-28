import { getBuses, getSchools } from "@/lib/db/queries";
import {
  listBudgets,
  listExpenses,
  listRevenues,
} from "@/lib/db/finance";
import { listProfileLabels } from "@/lib/db/profile-labels";
import { listRevenueTargets } from "@/lib/db/revenue-targets";
import { LedgerClient } from "@/components/finance/LedgerClient";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function AdminLedgerPage() {
  const [schools, buses, expenses, revenues, budgets, revenueTargets] =
    await Promise.all([
      getSchools(),
      getBuses(),
      listExpenses(),
      listRevenues(),
      listBudgets(),
      listRevenueTargets(),
    ]);
  const profileLabels = await listProfileLabels([
    ...expenses.flatMap((e) => [e.created_by, e.updated_by]),
    ...revenues.flatMap((r) => [r.created_by, r.updated_by]),
    ...budgets.flatMap((b) => [b.created_by, b.updated_by]),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
            Admin · Finance
          </p>
          <h1 className="mt-1 text-2xl font-bold text-electric-blue">
            Expense &amp; revenue ledger
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Enter transport expenses, revenues, budget envelopes, and revenue
            targets. Wired to Kai&apos;s{" "}
            <code className="text-xs">/api/expenses</code>,{" "}
            <code className="text-xs">/api/revenues</code>,{" "}
            <code className="text-xs">/api/budgets</code>, and{" "}
            <code className="text-xs">/api/revenue-targets</code>. Each edit
            records who changed it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="expenses" label="Export expenses" />
          <ExportCsvButton entity="revenues" label="Export revenues" />
          <ExportCsvButton entity="budgets" label="Export budgets" />
          <ExportCsvButton entity="revenue-targets" label="Export revenue targets" />
          <ImportCsvPanel
            entity="expenses"
            columnsHelpText="Required columns: title, amount, spent_on. Optional: category, school (slug or name), bus (label or plate), currency, notes. Matches existing expenses by (title, amount, spent_on)."
          />
        </div>
      </div>

      <LedgerClient
        schools={schools}
        buses={buses.map((b) => ({
          id: b.id,
          label: b.label,
          plate_number: b.plate_number,
          school_id: b.school_id,
        }))}
        initialExpenses={expenses}
        initialRevenues={revenues}
        initialBudgets={budgets}
        initialRevenueTargets={revenueTargets}
        profileLabels={profileLabels}
      />
    </main>
  );
}
