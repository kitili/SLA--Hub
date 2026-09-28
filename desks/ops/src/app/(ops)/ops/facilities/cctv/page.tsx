import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listCctv } from "@/lib/db/facilities";
import { CctvClient } from "@/components/facilities/CctvClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";

export default async function FacilitiesCctvPage() {
  const [schools, cameras] = await Promise.all([getSchools(), listCctv()]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">CCTV</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>CCTV</em> — camera type, location, quantity, and description.
          </p>
        </div>
        <Link
          href="/ops/facilities"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Facilities
        </Link>
      </div>

      <FacilitiesSubnav active="cctv" />
      <CctvClient schools={schools} initialCameras={cameras} />
    </div>
  );
}
