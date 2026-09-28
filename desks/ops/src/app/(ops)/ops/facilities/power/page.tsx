import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listPowerUsage } from "@/lib/db/facilities";
import { PowerUsageClient } from "@/components/facilities/PowerUsageClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";

export default async function FacilitiesPowerPage() {
  const [schools, entries] = await Promise.all([getSchools(), listPowerUsage()]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Power Usage</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>Power Usage</em> — receiving units, units spent, and balance.
          </p>
        </div>
        <Link
          href="/ops/facilities"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Facilities
        </Link>
      </div>

      <FacilitiesSubnav active="power" />
      <PowerUsageClient schools={schools} initialEntries={entries} />
    </div>
  );
}
