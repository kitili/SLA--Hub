import Link from "next/link";
import { getFacilitiesTopSheet } from "@/lib/db/facilities";
import { FacilitiesTopSheet } from "@/components/facilities/FacilitiesTopSheet";
import { FacilitiesSectionGrid } from "@/components/facilities/FacilitiesSectionGrid";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";
import { LiveSheetBanner } from "@/components/ops/LiveSheetBanner";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { AddCampusForm } from "@/components/facilities/AddCampusForm";

function monthOptions(year = 2026) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

type Props = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function FacilitiesOpsPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const today = new Date();
  // Checklist/generator imports currently run through July 2026 — don't open
  // an empty August+ topsheet by default (users can still pick later months).
  const calendarMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const fallback =
    today.getFullYear() === 2026 && today.getMonth() + 1 > 7 ? "2026-07" : calendarMonth;
  const monthKey =
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : fallback;

  const sheet = await getFacilitiesTopSheet({ monthKey });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Facilities</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Live Facilities sheet — Top Sheet with checklist, generator, and R&amp;M,
            plus housing, power, CCTV, classrooms, and SOPs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddCampusForm />
          <ExportCsvButton entity="facilities-top-sheet" label="Export top sheet" />
          <Link
            href="/"
            className="text-sm font-semibold text-electric-blue no-underline hover:underline"
          >
            ← Dashboards
          </Link>
        </div>
      </div>

      <FacilitiesSubnav active="hub" />
      <LiveSheetBanner
        domain="Facilities"
        detail="R&M, checklist, generator, housing, power, CCTV, classrooms, and SOPs are live in Ops — stop editing those tabs in Excel."
      />
      <FacilitiesTopSheet sheet={sheet} monthOptions={monthOptions(2026)} />
      <FacilitiesSectionGrid />
    </div>
  );
}
