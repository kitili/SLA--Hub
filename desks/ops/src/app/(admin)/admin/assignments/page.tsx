import { getSchools, getStudents } from "@/lib/db/queries";
import { listRoutes, listStudentStopAssignments, type RouteRow } from "@/lib/db/routes";
import { StopAssignmentPanel } from "@/components/admin/StopAssignmentPanel";
import { TempStopOverrideForm } from "@/components/admin/TempStopOverrideForm";

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
};

type AssignmentRow = NonNullable<Awaited<ReturnType<typeof listStudentStopAssignments>>[number]> & {
  route: RouteRow;
  school: SchoolRow;
};

export default async function AdminStopAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const { campus } = await searchParams;
  const schools = await getSchools();
  const selectedSchool = campus
    ? schools.find((school) => school.slug === campus) ?? null
    : null;

  const [routes, assignments, students] = await Promise.all([
    listRoutes(selectedSchool?.id),
    listStudentStopAssignments(),
    getStudents(selectedSchool?.slug),
  ]);

  const routeById = new Map(routes.map((route) => [route.id, route] as const));
  const schoolById = new Map(schools.map((school) => [school.id, school] as const));

  const visibleAssignments = assignments
    .map((assignment) => {
      const route = routeById.get(assignment.route_id ?? "");
      if (!route) return null;
      const school = schoolById.get(route.school_id);
      if (!school) return null;
      return {
        ...assignment,
        route,
        school,
      };
    })
    .filter((assignment): assignment is AssignmentRow => assignment !== null);

  const visibleSchools = selectedSchool ? [selectedSchool] : schools;

  const assignmentsForSchool = (schoolId: string) =>
    visibleAssignments.filter((assignment) => assignment.school.id === schoolId);

  const overrideOptions = visibleAssignments
    .filter((a) => a.route_id && a.stop_id)
    .map((a) => ({
      studentId: a.student_id,
      studentLabel: a.student
        ? `${a.student.first_name} ${a.student.last_name}`
        : a.student_id,
      routeId: a.route_id as string,
      routeName: a.route.name,
      stopId: a.stop_id,
      stopName: a.stop?.name ?? a.stop_id,
      lat: a.stop?.lat ?? null,
      lng: a.stop?.lng ?? null,
    }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Admin · Routes
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">
          Student stop assignments
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Campus-filtered student stop assignments for the five Silverleaf
          campuses. Use temporary overrides when a parent needs a different
          pickup for a few days.
        </p>
      </div>

      <TempStopOverrideForm options={overrideOptions} />

      <form className="ui-rise ui-rise-delay-1 mt-6 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]" method="get">
        <label className="flex min-w-[14rem] flex-col gap-1.5 text-sm">
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
        <button
          type="submit"
          className="rounded-[var(--radius-sm)] bg-gradient-to-br from-navy-light to-electric-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,35,104,0.2)] transition hover:brightness-105"
        >
          Filter
        </button>
      </form>

      {routes.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
          No routes yet. Ask Kai/Jfree to seed or create a route first.
        </div>
      ) : (
        <StopAssignmentPanel
          routes={routes}
          students={students}
          assignments={assignments}
        />
      )}

      {routes.length > 0 ? (
        <div className="mt-8 space-y-6">
          {visibleSchools
            .map((school) => ({
              school,
              assignments: assignmentsForSchool(school.id),
            }))
            .filter(({ assignments }) => assignments.length > 0 || selectedSchool)
            .map(({ school, assignments }) => (
              <section
                key={school.id}
                className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Campus
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-electric-blue">
                      {school.name}
                    </h2>
                  </div>
                  <span className="rounded-full bg-light-blue-30 px-2.5 py-0.5 text-xs font-bold text-electric-blue">
                    {assignments.length}
                  </span>
                </div>

                {assignments.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-muted">
                    No student stop assignments yet for this campus.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-white/90">
                    {assignments.map((assignment) => (
                      <li
                        key={`${assignment.student_id}-${assignment.stop_id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {assignment.student
                              ? `${assignment.student.first_name} ${assignment.student.last_name}`
                              : assignment.student_id}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {assignment.student?.class_name
                              ? `${assignment.student.class_name} · `
                              : ""}
                            {assignment.route.name} ({assignment.route.direction.toUpperCase()})
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-electric-blue">
                          {assignment.stop?.name ?? assignment.stop_id}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {visibleAssignments.length === 0 && !selectedSchool ? (
            <div className="rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
              No student stop assignments loaded yet.
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
