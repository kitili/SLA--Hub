import { getBuses, getSchools, getStudents } from "@/lib/db/queries";
import { listStudentStopAssignments } from "@/lib/db/routes";
import { StudentInitials } from "@/components/students/StudentInitials";
import { StudentStopInfo } from "@/components/students/StudentStopInfo";
import { compareAlpha, sortStudentsByName } from "@/lib/sort/alphabetical";
import { StudentEditDialog } from "@/components/students/StudentEditDialog";
import { DeactivatedStudents } from "@/components/students/DeactivatedStudents";
import type { StudentWithDetails } from "@/types/database";

function formatPhone(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[67]\d{8}$/.test(stripped) ? `+255${stripped}` : raw;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; campus?: string; busId?: string }>;
}) {
  const { q, campus, busId } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [schools, students, stopAssignments, buses] = await Promise.all([
    getSchools(),
    getStudents(campus || undefined),
    listStudentStopAssignments(),
    getBuses(campus || undefined),
  ]);

  const studentsByStop = new Map<
    string,
    { id: string; first_name: string; last_name: string }[]
  >();
  for (const a of stopAssignments) {
    if (!a.stop || !a.student) continue;
    if (!studentsByStop.has(a.stop_id)) studentsByStop.set(a.stop_id, []);
    studentsByStop.get(a.stop_id)!.push(a.student);
  }

  const assignmentByStudent = new Map(
    stopAssignments
      .filter((a) => a.stop)
      .map((a) => [a.student_id, a.stop!] as const),
  );

  const busByRoute = new Map(
    buses.filter((b) => b.route_id).map((b) => [b.route_id as string, b] as const),
  );
  const routeByStudent = new Map(
    stopAssignments
      .filter((a) => a.route_id)
      .map((a) => [a.student_id, a.route_id as string] as const),
  );
  const busByStudent = (studentId: string) => {
    const routeId = routeByStudent.get(studentId);
    return routeId ? busByRoute.get(routeId) ?? null : null;
  };

  const filtered = sortStudentsByName(
    students.filter((s) => {
      if (
        query &&
        !`${s.first_name} ${s.last_name}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (busId) {
        const bus = busByStudent(s.id);
        if (!bus || bus.id !== busId) return false;
      }
      return true;
    }),
  );

  const grouped = new Map<string, StudentWithDetails[]>();
  for (const student of filtered) {
    const key = student.school_name ?? "Unknown campus";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(student);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="ui-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Admin · Roster
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-electric-blue">
          Students
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Silverleaf transport roster — names, pickup points, and bus
          assignment by campus. Fee balance appears only after a scan.
        </p>
        <a
          href="/admin/students/new"
          className="mt-4 inline-block rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-light"
        >
          + Add student
        </a>
      </div>

      <div className="ui-rise ui-rise-delay-1 mt-6 grid gap-3 sm:grid-cols-3">
        <div className="ui-panel px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Showing
          </p>
          <p className="mt-1 text-2xl font-extrabold text-electric-blue">
            {filtered.length}
          </p>
        </div>
        <div className="ui-panel px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Assigned to a bus
          </p>
          <p className="mt-1 text-2xl font-extrabold text-electric-blue">
            {filtered.filter((s) => Boolean(busByStudent(s.id))).length}
          </p>
        </div>
        <div className="ui-panel px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Campuses
          </p>
          <p className="mt-1 text-2xl font-extrabold text-electric-blue">
            {grouped.size}
          </p>
        </div>
      </div>

      <form
        className="ui-rise ui-rise-delay-2 ui-panel mt-6 flex flex-wrap items-end gap-3 p-4"
        method="get"
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Search by name
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="e.g. Travis"
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Campus
          </span>
          <select
            name="campus"
            defaultValue={campus ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All campuses</option>
            {schools.map((school) => (
              <option key={school.id} value={school.slug}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Bus
          </span>
          <select
            name="busId"
            defaultValue={busId ?? ""}
            className="rounded-[var(--radius-sm)] border border-card-border bg-white/90 px-3 py-2.5 text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-gold/40"
          >
            <option value="">All buses</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
                {b.plate_number ? ` (${b.plate_number})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105"
        >
          Filter
        </button>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30/80 p-10 text-center text-sm text-ink-muted">
          {students.length === 0 ? (
            <>
              No students loaded. Run <code>seed_silverleaf.sql</code> in
              Supabase.
            </>
          ) : (
            "No students match that search."
          )}
        </div>
      ) : (
        [...grouped.entries()]
          .sort(([a], [b]) => compareAlpha(a, b))
          .map(([campusName, campusStudents], campusIdx) => (
          <section
            key={campusName}
            className={`mt-10 ${campusIdx === 0 ? "ui-rise ui-rise-delay-3" : ""}`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-electric-blue">
                {campusName}
              </h2>
              <span className="rounded-full bg-light-blue-30 px-2.5 py-0.5 text-xs font-bold text-electric-blue">
                {campusStudents.length}
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {sortStudentsByName(campusStudents).map((student) => (
                <li
                  key={student.id}
                  className="ui-panel flex flex-col gap-4 p-4 transition hover:shadow-[var(--shadow-lg)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <StudentInitials
                      firstName={student.first_name}
                      lastName={student.last_name}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-ink">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {student.class_name || "No class"}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        Parent · {formatPhone(student.parent_phone)}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-faint">
                        Bus ·{" "}
                        {(() => {
                          const bus = busByStudent(student.id);
                          return bus
                            ? `${bus.label}${bus.plate_number ? ` (${bus.plate_number})` : ""}`
                            : "unassigned";
                        })()}
                      </p>
                      {(() => {
                        const stop = assignmentByStudent.get(student.id);
                        if (!stop) {
                          return (
                            <p className="mt-2 text-xs text-ink-faint">
                              Pickup point · unassigned
                            </p>
                          );
                        }
                        const others = (
                          studentsByStop.get(stop.id) ?? []
                        ).filter((s) => s.id !== student.id);
                        return (
                          <StudentStopInfo
                            lat={stop.lat}
                            lng={stop.lng}
                            otherStudents={others}
                          />
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center self-end sm:self-center">
                    <span className="rounded-full bg-light-blue-30 px-2.5 py-1 text-xs font-semibold text-electric-blue">
                      {(() => {
                        const bus = busByStudent(student.id);
                        return bus ? bus.label : "No bus";
                      })()}
                    </span>
                  <div className="flex shrink-0 flex-col items-end gap-2 self-end sm:self-center">
                    <StudentEditDialog student={student} />
                    <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                        QR code
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-electric-blue">
                        {student.qr_code ?? "—"}
                      </p>
                    </div>
                    {student.qr_code ? (
                      <QrDisplay value={student.qr_code} />
                    ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <DeactivatedStudents campus={campus || undefined} />
    </main>
  );
}
