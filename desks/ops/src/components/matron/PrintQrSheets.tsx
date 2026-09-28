"use client";

import { useMemo, useState } from "react";
import { StudentQrDisplay } from "@/components/matron/StudentQrDisplay";
import { sortByAlpha, sortStudentsByName } from "@/lib/sort/alphabetical";
import type { Bus, StudentWithDetails } from "@/types/database";

type Props = {
  students: StudentWithDetails[];
  buses: Bus[];
  studentBusIds: Record<string, string[]>;
};

export function PrintQrSheets({ students, buses, studentBusIds }: Props) {
  const busesAz = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  const [busFilter, setBusFilter] = useState<string>("all");

  const visible = useMemo(() => {
    const list = students.filter((s) => {
      if (busFilter === "all") return true;
      return (studentBusIds[s.id] ?? []).includes(busFilter);
    });
    return sortStudentsByName(list);
  }, [students, busFilter, studentBusIds]);

  return (
    <div className="mt-5 space-y-5">
      <div className="print:hidden flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="ui-cta min-h-11"
        >
          Print sheets
        </button>

        <label className="text-sm font-semibold text-ink">
          Bus
          <select
            value={busFilter}
            onChange={(e) => setBusFilter(e.target.value)}
            className="ml-2 rounded-[var(--radius-sm)] border border-card-border bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-light-blue"
          >
            <option value="all">All buses (A–Z)</option>
            {busesAz.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
                {b.plate_number ? ` · ${b.plate_number}` : ""}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-ink-muted">
          {visible.length} sheet{visible.length === 1 ? "" : "s"} · students A–Z
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted print:hidden">
          No students with QR codes match this bus.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-3">
          {visible.map((student) => {
            const fullName = `${student.first_name} ${student.last_name}`;
            return (
              <li
                key={student.id}
                className="break-inside-avoid rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)] print:shadow-none"
              >
                <p className="text-center text-base font-bold text-ink">
                  {fullName}
                </p>
                <p className="mt-0.5 text-center text-xs text-ink-muted">
                  {[student.class_name, student.school_name]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                <div className="mt-3 flex justify-center">
                  <StudentQrDisplay code={student.qr_code!} size="sm" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
