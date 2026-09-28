import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listKitchenIngredients } from "@/lib/db/kitchen";
import { KitchenClient } from "@/components/kitchen/KitchenClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function KitchenOpsPage() {
  const [schoolsRaw, ingredients] = await Promise.all([
    getSchools(),
    listKitchenIngredients(),
  ]);
  const schools = [...schoolsRaw].sort((a, b) => {
    const score = (s: { name: string; slug: string }) =>
      /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`) ? 0 : 1;
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen procurement</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Campus/month headcount, computed ingredient requirements, budget vs actual,
            and purchases — the working view behind the Top Sheet.
          </p>
        </div>
        <Link
          href="/ops/kitchen/dashboard"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Top Sheet
        </Link>
      </div>

      <KitchenSubnav active="procurement" />

      <div className="mb-6 flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-ingredients" label="Export ingredients" />
          <ImportCsvPanel
            entity="kitchen-ingredients"
            columnsHelpText="Required: name. Optional: unit, category (grain/vegetable/meat/other), calc_method (headcount_ratio/flat_weekly), people_per_kg, kg_per_week, default_unit_price. Matches by name."
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-staff" label="Export staff" />
          <ImportCsvPanel
            entity="kitchen-staff"
            columnsHelpText="Required: school_name (or school), name, role (cook/head_of_kitchens/other). Optional: active. Matches by (school, name)."
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-budgets" label="Export budgets" />
          <ImportCsvPanel
            entity="kitchen-budgets"
            columnsHelpText="Required: school_name (or school), month (YYYY-MM or YYYY-MM-DD), budget_amount. Optional: currency (defaults TZS). One row per campus/month — re-importing the same campus/month overwrites that figure."
          />
        </div>
        <ExportCsvButton entity="kitchen-vendors" label="Export vendors" />
        <ExportCsvButton entity="kitchen-purchases" label="Export purchases" />
        <ExportCsvButton entity="kitchen-headcount-lines" label="Export headcount" />
      </div>

      <KitchenClient schools={schools} ingredients={ingredients} />
    </div>
  );
}
