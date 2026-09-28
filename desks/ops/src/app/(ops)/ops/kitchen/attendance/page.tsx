import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { KitchenMealAttendanceClient } from "@/components/kitchen/KitchenMealAttendanceClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

export default async function KitchenAttendancePage() {
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
            Meal attendance, per campus — actual headcount served at each meal.
          </p>
        </div>
        <ExportCsvButton entity="kitchen-meal-attendance" />
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="attendance" />
      <KitchenMealAttendanceClient schools={schools} />
    </div>
  );
}
