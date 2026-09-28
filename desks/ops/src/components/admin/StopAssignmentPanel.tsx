"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RouteOption = {
  id: string;
  name: string;
  direction: string;
  school_id: string;
};

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string | null;
  school_id: string;
};

type AssignmentRow = {
  student_id: string;
  stop_id: string;
  route_id: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    class_name: string | null;
  } | null;
  stop: { id: string; name: string } | null;
};

type Props = {
  routes: RouteOption[];
  students: StudentOption[];
  assignments: AssignmentRow[];
};

export function StopAssignmentPanel({
  routes,
  students,
  assignments: initialAssignments,
}: Props) {
  const router = useRouter();
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === routeId) ?? null,
    [routes, routeId],
  );

  const studentsForRoute = useMemo(() => {
    if (!selectedRoute) return students;
    return students.filter((s) => s.school_id === selectedRoute.school_id);
  }, [students, selectedRoute]);

  const filteredAssignments = useMemo(() => {
    if (!routeId) return initialAssignments;
    return initialAssignments.filter((a) => a.route_id === routeId);
  }, [initialAssignments, routeId]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!studentId || !selectedRoute) {
      setError("Pick a route and a student");
      return;
    }
    if (!lat.trim() || !lng.trim() || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setError("Enter this student's latitude and longitude");
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/student-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          routeId: selectedRoute.id,
          schoolId: selectedRoute.school_id,
          lat: latNum,
          lng: lngNum,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Assign failed (${res.status})`);
        return;
      }
      setOkMsg("Student assigned to their stop");
      setStudentId("");
      setLat("");
      setLng("");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form
        onSubmit={assign}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Assign student → coordinate
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Each student gets their own stop at the exact point entered — no
          matching to a nearby stop.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Route</span>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            >
              {routes.length === 0 ? (
                <option value="">No routes</option>
              ) : (
                routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route.direction.toUpperCase()})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Student</span>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            >
              <option value="">Select student</option>
              {studentsForRoute.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.last_name}, {student.first_name}
                  {student.class_name ? ` · ${student.class_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Latitude</span>
            <input
              type="text"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-3.376694"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            />
          </label>
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Longitude</span>
            <input
              type="text"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="36.901947"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || !routeId}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Assign stop"}
        </button>
        {error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
        ) : null}
        {okMsg ? (
          <p className="mt-3 text-sm font-semibold text-success">{okMsg}</p>
        ) : null}
      </form>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Current assignments
          {selectedRoute ? ` · ${selectedRoute.name}` : ""}
        </h2>
        {filteredAssignments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No student↔stop assignments for this route yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
            {filteredAssignments.map((row) => (
              <li
                key={`${row.student_id}-${row.stop_id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="font-semibold text-ink">
                  {row.student
                    ? `${row.student.first_name} ${row.student.last_name}`
                    : row.student_id}
                  {row.student?.class_name ? (
                    <span className="ml-2 font-normal text-ink-muted">
                      {row.student.class_name}
                    </span>
                  ) : null}
                </span>
                <span className="text-electric-blue">
                  {row.stop?.name ?? row.stop_id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
