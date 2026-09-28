import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listHouses, listHouseOccupancy } from "@/lib/db/facilities";
import { HousesClient } from "@/components/facilities/HousesClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";

export default async function FacilitiesHousesPage() {
  const [schools, houses, occupancy] = await Promise.all([
    getSchools(),
    listHouses(),
    listHouseOccupancy(),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Staff Housing</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>Houses Accommodation</em> — letter, rooms, furniture, and
            Available / Taken with occupancy history.
          </p>
        </div>
        <Link
          href="/ops/facilities"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Facilities
        </Link>
      </div>

      <FacilitiesSubnav active="houses" />
      <HousesClient schools={schools} initialHouses={houses} initialOccupancy={occupancy} />
    </div>
  );
}
