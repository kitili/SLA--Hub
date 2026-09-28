import Link from "next/link";
import { Suspense } from "react";
import { MatronStudentList } from "@/components/matron/MatronStudentList";
import {
  getBuses,
  getStudentBusIdsByRoute,
  getStudentsForSession,
} from "@/lib/db/queries";
import { getSessionProfile } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ busId?: string; school?: string; class?: string }>;
};

export default async function MatronStudentsPage({ searchParams }: Props) {
  const session = await getSessionProfile();
  const { busId: busIdParam, school: schoolParam, class: classParam } =
    await searchParams;
  const [{ students }, buses, studentBusIds] = await Promise.all([
    session
      ? getStudentsForSession(session)
      : Promise.resolve({ students: [], busId: null }),
    getBuses(),
    getStudentBusIdsByRoute(),
  ]);

  const initialBusId =
    busIdParam && buses.some((b) => b.id === busIdParam) ? busIdParam : "";
  const initialSchool = schoolParam?.trim() ?? "";
  const initialClass = classParam?.trim() ?? "";

  const busLabel = initialBusId
    ? buses.find((b) => b.id === initialBusId)?.label
    : null;

  return (
    <main className="matron-page !max-w-3xl">
      <header className="mb-5">
        <p className="matron-kicker">Roster</p>
        <h1 className="matron-title mt-1">
          {busLabel
            ? `${busLabel} students`
            : initialSchool
              ? `${initialSchool} students`
              : "All students"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Full fleet roster — pick any bus or school below. Names are always
          A–Z by the full name on each card. Choose &quot;All buses&quot; /
          &quot;All schools&quot; to browse everyone.
        </p>
        <div className="mt-4">
          <Link href="/matron/students/print" className="matron-btn-secondary">
            Print QR sheets
          </Link>
        </div>
      </header>

      {students.length === 0 ? (
        <div className="matron-surface border-dashed p-8 text-center text-sm text-ink-muted">
          No students loaded. Ask transport to seed the roster.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="matron-surface p-8 text-center text-sm text-ink-muted">
              Loading roster…
            </div>
          }
        >
          <MatronStudentList
            students={students}
            buses={buses}
            studentBusIds={studentBusIds}
            initialBusId={initialBusId}
            initialSchool={initialSchool}
            initialClass={initialClass}
          />
        </Suspense>
      )}
    </main>
  );
}
