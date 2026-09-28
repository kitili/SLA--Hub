import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { KitchenSurveyReview } from "@/components/kitchen/KitchenSurveyReview";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

export default async function KitchenSurveysPage() {
  const schoolsRaw = await getSchools();
  // Prefer Usa River first — densest imported kitchen sheet data.
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
            Learner food satisfaction survey responses, per campus.
          </p>
        </div>
        <ExportCsvButton entity="kitchen-survey-responses" />
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="surveys" />

      <div className="flex flex-col gap-6">
        <KitchenSurveyReview schools={schools} />
      </div>
    </div>
  );
}
