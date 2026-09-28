import Link from "next/link";
import { PrintQrSheets } from "@/components/matron/PrintQrSheets";
import {
  getBuses,
  getStudentBusIdsByRoute,
  getStudentsForSession,
} from "@/lib/db/queries";
import { getSessionProfile } from "@/lib/auth";
import { sortStudentsByName } from "@/lib/sort/alphabetical";

export default async function MatronStudentsPrintPage() {
  const session = await getSessionProfile();
  const [{ students }, busesRaw, studentBusIds] = await Promise.all([
    session
      ? getStudentsForSession(session)
      : Promise.resolve({ students: [], busId: null }),
    getBuses(),
    getStudentBusIdsByRoute(),
  ]);
  const buses = busesRaw;
  const withQr = sortStudentsByName(students.filter((s) => Boolean(s.qr_code)));

  return (
    <main className="flex w-full flex-col px-4 py-5 print:max-w-none print:px-0 print:py-0">
      <Link
        href="/matron/students"
        className="print:hidden text-sm font-semibold text-electric-blue no-underline"
      >
        ← Back to students
      </Link>

      <div className="mt-4 print:mt-0">
        <p className="print:hidden text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Demo roster
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue print:text-xl">
          Print QR sheets
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted print:hidden">
          Print-friendly QR cards for the roster. Prefer students with an
          assigned code ({withQr.length} of {students.length}).
        </p>
      </div>

      {withQr.length === 0 ? (
        <div className="mt-5 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
          No QR codes assigned yet.
        </div>
      ) : (
        <PrintQrSheets
          students={withQr}
          buses={buses}
          studentBusIds={studentBusIds}
        />
      )}
    </main>
  );
}
