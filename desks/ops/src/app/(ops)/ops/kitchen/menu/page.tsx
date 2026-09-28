import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { KitchenMenuPlannerClient } from "@/components/kitchen/KitchenMenuPlannerClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { ImportCsvPanel } from "@/components/admin/ImportCsvPanel";

export default async function KitchenMenuPage() {
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
            Plan what&apos;s actually being cooked — per campus, day, and meal.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ExportCsvButton entity="kitchen-menu-items" label="Export dishes" />
          <ImportCsvPanel
            entity="kitchen-menu-items"
            columnsHelpText="Required: name. Optional: notes. Matches by name."
          />
          <ExportCsvButton entity="kitchen-menu-plans" label="Export week plans" />
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="menu" />
      <KitchenMenuPlannerClient schools={schools} />
    </div>
  );
}
