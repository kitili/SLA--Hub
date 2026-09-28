import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listSops } from "@/lib/db/facilities";
import { SopsClient } from "@/components/facilities/SopsClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

export default async function FacilitiesSopsPage() {
  const [schools, sops] = await Promise.all([getSchools(), listSops()]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Facilities SOPs</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>Facilities SOPs</em> — role and cadence procedures (expand to
            read full content).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportCsvButton entity="facilities-sops" label="Export SOPs" />
          <Link
            href="/ops/facilities"
            className="text-sm font-semibold text-electric-blue no-underline hover:underline"
          >
            ← Facilities
          </Link>
        </div>
      </div>

      <FacilitiesSubnav active="sops" />
      <SopsClient schools={schools} initialSops={sops} />
    </div>
  );
}
