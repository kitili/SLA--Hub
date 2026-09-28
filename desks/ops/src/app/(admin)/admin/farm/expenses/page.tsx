import { listFarmBudgets, listFarmExpenses, listPlots } from "@/lib/db/farm";
import { FarmExpensesClient } from "@/components/farm/FarmExpensesClient";
import { FarmSubnav } from "@/components/farm/FarmSubnav";

export default async function AdminFarmExpensesPage() {
  const [plots, expenses, budgets] = await Promise.all([
    listPlots(),
    listFarmExpenses(),
    listFarmBudgets(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Admin · Farm
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">
          Farm expenses &amp; budget
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Log categorized farm spend and set monthly budget envelopes —
          replaces the manual Farms Expenses and Farms Budget tabs. Overruns
          raise SMS alerts via the farm-alerts cron.
        </p>
      </div>

      <FarmSubnav active="expenses" />

      <FarmExpensesClient
        plots={plots}
        initialExpenses={expenses}
        initialBudgets={budgets}
      />
    </main>
  );
}
