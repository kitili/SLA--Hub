import Link from "next/link";
import { requireLoginPage } from "@/lib/require-module-page";
import { nairobiDateString } from "@/lib/nairobi";
import { loadAcademySnapshot } from "@/lib/desks";
import { DepartmentDeskGrid } from "@/components/desk/department-desk-grid";

export default async function DepartmentDesksPage() {
  await requireLoginPage("one_to_fives");
  const snapshot = await loadAcademySnapshot(nairobiDateString());
  const liveDesks = snapshot.desks.filter((desk) => desk.staffCount > 0 || desk.projects.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-navy">Team desks</h1>
        <p className="mt-1 text-sm text-black/55">
          Each department has one desk: today’s work, the sprint, and that team’s 1–5s.{" "}
          <Link href="/dashboard/snapshot" className="text-navy underline">
            Week snapshot
          </Link>
        </p>
      </div>
      <DepartmentDeskGrid desks={liveDesks} />
    </div>
  );
}
