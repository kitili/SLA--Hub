"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StudentInitials } from "@/components/students/StudentInitials";
import {
  compareAlpha,
  sortByAlpha,
  sortStudentsByName,
} from "@/lib/sort/alphabetical";
import type { Bus, StudentWithDetails } from "@/types/database";

type Props = {
  students: StudentWithDetails[];
  buses: Bus[];
  studentBusIds: Record<string, string[]>;
  initialBusId?: string;
  initialSchool?: string;
  initialClass?: string;
};

function rosterQueryString(input: {
  busId: string;
  school: string;
  className: string;
}) {
  const params = new URLSearchParams();
  if (input.busId) params.set("busId", input.busId);
  if (input.school) params.set("school", input.school);
  if (input.className) params.set("class", input.className);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function MatronStudentList({
  students,
  buses,
  studentBusIds,
  initialBusId = "",
  initialSchool = "",
  initialClass = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState(initialClass);
  const [schoolFilter, setSchoolFilter] = useState(initialSchool);
  const [busFilter, setBusFilter] = useState(initialBusId);

  useEffect(() => {
    setBusFilter(searchParams.get("busId") ?? initialBusId);
    setSchoolFilter(searchParams.get("school") ?? initialSchool);
    setClassFilter(searchParams.get("class") ?? initialClass);
  }, [searchParams, initialBusId, initialSchool, initialClass]);

  const syncUrl = (next: {
    busId: string;
    school: string;
    className: string;
  }) => {
    router.replace(`${pathname}${rosterQueryString(next)}`, { scroll: false });
  };

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.class_name?.trim()) set.add(s.class_name.trim());
    }
    return [...set].sort(compareAlpha);
  }, [students]);

  const schools = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.school_name?.trim()) set.add(s.school_name.trim());
    }
    return [...set].sort(compareAlpha);
  }, [students]);

  const busLabelById = useMemo(
    () => new Map(buses.map((b) => [b.id, b.label])),
    [buses],
  );

  const busLabelsForStudent = (studentId: string): string => {
    const labels = (studentBusIds[studentId] ?? [])
      .map((id) => busLabelById.get(id))
      .filter((label): label is string => Boolean(label));
    return sortByAlpha(labels, (l) => l).join(", ");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = students.filter((student) => {
      if (classFilter && student.class_name !== classFilter) return false;
      if (schoolFilter && student.school_name !== schoolFilter) return false;
      if (busFilter) {
        const ids = studentBusIds[student.id] ?? [];
        if (!ids.includes(busFilter)) return false;
      }
      if (!q) return true;
      const fullName =
        `${student.first_name} ${student.last_name}`.toLowerCase();
      const busText = (studentBusIds[student.id] ?? [])
        .map((id) => busLabelById.get(id))
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        fullName.includes(q) ||
        student.class_name?.toLowerCase().includes(q) ||
        student.school_name?.toLowerCase().includes(q) ||
        busText.includes(q)
      );
    });
    return sortStudentsByName(matches);
  }, [
    students,
    query,
    classFilter,
    schoolFilter,
    busFilter,
    studentBusIds,
    busLabelById,
  ]);

  const busesAz = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  const hasFilters = Boolean(
    classFilter || schoolFilter || busFilter || query,
  );

  return (
    <div className="space-y-3">
      <div className="matron-surface space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            Showing{" "}
            <span className="font-bold text-electric-blue">
              {filtered.length}
            </span>
            {filtered.length !== students.length
              ? ` of ${students.length}`
              : ""}{" "}
            students
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setClassFilter("");
                setSchoolFilter("");
                setBusFilter("");
                syncUrl({ busId: "", school: "", className: "" });
              }}
              className="text-xs font-semibold text-electric-blue"
            >
              Show all students
            </button>
          ) : null}
        </div>

        <label className="block">
          <span className="sr-only">Search students</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, class, school, or bus…"
            className="w-full rounded-xl border border-card-border bg-[var(--app-bg)] py-2.5 px-3.5 text-sm text-ink outline-none transition focus:border-electric-blue focus:ring-2 focus:ring-light-blue/40"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Bus
            <select
              value={busFilter}
              onChange={(e) => {
                const busId = e.target.value;
                setBusFilter(busId);
                syncUrl({
                  busId,
                  school: schoolFilter,
                  className: classFilter,
                });
              }}
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2.5 text-sm font-semibold normal-case text-ink"
            >
              <option value="">All buses</option>
              {busesAz.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Class
            <select
              value={classFilter}
              onChange={(e) => {
                const className = e.target.value;
                setClassFilter(className);
                syncUrl({
                  busId: busFilter,
                  school: schoolFilter,
                  className,
                });
              }}
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2.5 text-sm font-semibold normal-case text-ink"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            School
            <select
              value={schoolFilter}
              onChange={(e) => {
                const school = e.target.value;
                setSchoolFilter(school);
                syncUrl({
                  busId: busFilter,
                  school,
                  className: classFilter,
                });
              }}
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2.5 text-sm font-semibold normal-case text-ink"
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30/80 p-8 text-center text-sm text-ink-muted">
          No students match your filters. Try &quot;All buses&quot; and
          &quot;All schools&quot;, or clear search.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((student, index) => {
            const fullName = `${student.first_name} ${student.last_name}`;
            const busLine = busLabelsForStudent(student.id);
            const delayClass =
              index < 4
                ? `ui-rise ui-rise-delay-${Math.min(index, 3)}`
                : "ui-rise";

            return (
              <li key={student.id} className={delayClass}>
                <Link
                  href={`/matron/students/${student.id}`}
                  className="group flex h-full flex-col items-center matron-surface p-4 text-center no-underline transition hover:border-electric-blue/25"
                >
                  <StudentInitials
                    firstName={student.first_name}
                    lastName={student.last_name}
                    className="h-14 w-14 text-lg"
                  />
                  <p className="mt-3 line-clamp-2 text-sm font-extrabold text-ink group-hover:text-electric-blue">
                    {fullName}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                    {[student.class_name, student.school_name, busLine || null]
                      .filter(Boolean)
                      .join(" · ") || "No class"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
