import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listKitchenSupplies } from "@/lib/db/kitchen";
import { KitchenSuppliesClient } from "@/components/kitchen/KitchenSuppliesClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function KitchenSuppliesPage() {
  const [schoolsRaw, supplies] = await Promise.all([getSchools(), listKitchenSupplies()]);
  // Prefer Usa River first, matching every other Kitchen page.
  const schools = [...schoolsRaw].sort((a, b) => {
    const score = (s: { name: string; slug: string }) =>
      /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`) ? 0 : 1;
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Cleaning and consumable supplies, per campus — separate from food ingredients.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-supplies" label="Export supplies" />
          <ImportCsvPanel
            entity="kitchen-supplies"
            columnsHelpText="Required: name. Optional: unit, default_unit_price. Matches by name."
          />
          <ExportCsvButton entity="kitchen-supply-purchases" label="Export purchases" />
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="supplies" />
      <KitchenSuppliesClient schools={schools} supplies={supplies} />
    </div>
  );
}
