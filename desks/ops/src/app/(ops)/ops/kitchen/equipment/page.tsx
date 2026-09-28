import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { KitchenEquipmentClient } from "@/components/kitchen/KitchenEquipmentClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function KitchenEquipmentPage() {
  const schoolsRaw = await getSchools();
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
            Equipment and utensils, per campus — quantity, condition, and maintenance.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-equipment" />
          <ImportCsvPanel
            entity="kitchen-equipment"
            columnsHelpText="Required: school_name (or school), name, category (cookware/appliance/furniture/other), condition (good/fair/poor/needs_repair), quantity. Optional: purchased_on (YYYY-MM-DD), replacement_cost, notes. Matches by (school, name)."
          />
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="equipment" />
      <KitchenEquipmentClient schools={schools} />
    </div>
  );
}
