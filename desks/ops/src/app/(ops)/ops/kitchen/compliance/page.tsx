import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listKitchenChecklistEntries, listKitchenChecklistTemplates } from "@/lib/db/kitchen";
import { getCurrentChecklistPeriods } from "@/lib/kitchen/checklist-periods";
import { KitchenComplianceReview } from "@/components/kitchen/KitchenComplianceReview";
import { ChecklistClient } from "@/components/kitchen/ChecklistClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";

export default async function KitchenCompliancePage() {
  const schoolsRaw = await getSchools();
  // Prefer Usa River first — densest imported kitchen sheet data.
  const schools = [...schoolsRaw].sort((a, b) => {
    const score = (s: { name: string; slug: string }) =>
      /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`) ? 0 : 1;
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });
  const defaultSchoolId = schools[0]?.id ?? "";

  const periods = getCurrentChecklistPeriods();
  const [dailyTemplates, weeklyTemplates, monthlyTemplates, checklistEntries] = await Promise.all([
    listKitchenChecklistTemplates("daily"),
    listKitchenChecklistTemplates("weekly"),
    listKitchenChecklistTemplates("monthly"),
    defaultSchoolId
      ? listKitchenChecklistEntries(defaultSchoolId, Object.values(periods))
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Daily / weekly / monthly checklist scores per campus, and SOP reference.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="compliance" />

      <div className="flex flex-col gap-6">
        <KitchenComplianceReview schools={schools} />
        <ChecklistClient
          embedded
          schools={schools}
          defaultSchoolId={defaultSchoolId}
          periods={periods}
          templates={{ daily: dailyTemplates, weekly: weeklyTemplates, monthly: monthlyTemplates }}
          initialEntries={checklistEntries}
        />
      </div>
    </div>
  );
}
