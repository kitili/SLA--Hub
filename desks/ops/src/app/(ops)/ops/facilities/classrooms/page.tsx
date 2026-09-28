import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listClassroomItems } from "@/lib/db/facilities";
import { ClassroomItemsClient } from "@/components/facilities/ClassroomItemsClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";

export default async function FacilitiesClassroomsPage() {
  const [schools, items] = await Promise.all([getSchools(), listClassroomItems()]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Classroom Inventory</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>Classrooms facility Report</em> — grade, item, quantity,
            remarks.
          </p>
        </div>
        <Link
          href="/ops/facilities"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Facilities
        </Link>
      </div>

      <FacilitiesSubnav active="classrooms" />
      <ClassroomItemsClient schools={schools} initialItems={items} />
    </div>
  );
}
