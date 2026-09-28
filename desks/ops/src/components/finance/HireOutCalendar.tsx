"use client";

import { useMemo, useState } from "react";
import type { HireOut, HireStatus } from "@/lib/db/finance";
import { sortByAlpha } from "@/lib/sort/alphabetical";

type BusOption = {
  id: string;
  label: string;
  plate_number: string;
};

type Props = {
  buses: BusOption[];
  hireOuts: HireOut[];
};

const ACTIVE_STATUSES: HireStatus[] = ["booked", "in_progress"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function overlapsDay(hire: HireOut, day: Date) {
  const start = new Date(hire.start_at);
  const end = new Date(hire.end_at);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    23,
    59,
    59,
    999,
  );
  return start <= dayEnd && end >= dayStart;
}

function monthCells(month: Date) {
  const first = startOfMonth(month);
  const startPad = first.getDay(); // Sun=0
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function HireOutCalendar({ buses, hireOuts }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [busFilter, setBusFilter] = useState("all");

  const busesAz = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  const activeHires = useMemo(
    () =>
      hireOuts.filter(
        (h) =>
          ACTIVE_STATUSES.includes(h.status) &&
          (busFilter === "all" || h.bus_id === busFilter),
      ),
    [hireOuts, busFilter],
  );

  const cells = useMemo(() => monthCells(cursor), [cursor]);

  const hiresByDay = useMemo(() => {
    const map = new Map<string, HireOut[]>();
    for (const cell of cells) {
      if (!cell) continue;
      const key = dayKey(cell);
      map.set(
        key,
        activeHires.filter((h) => overlapsDay(h, cell)),
      );
    }
    return map;
  }, [cells, activeHires]);

  const selectedHires = useMemo(
    () => activeHires.filter((h) => overlapsDay(h, selected)),
    [activeHires, selected],
  );

  const hiredBusIds = new Set(selectedHires.map((h) => h.bus_id));
  const availableBuses = buses.filter((b) => {
    if (busFilter !== "all" && b.id !== busFilter) return false;
    return !hiredBusIds.has(b.id);
  });
  const hiredBuses = buses.filter((b) => {
    if (busFilter !== "all" && b.id !== busFilter) return false;
    return hiredBusIds.has(b.id);
  });

  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Hire-out availability calendar
          </h2>
          <p className="mt-1 max-w-xl text-xs text-ink-faint">
            Which buses are booked for hire-outs vs free for school duty.
            Uses <code>GET /api/hire-outs</code> (booked / in progress).
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Bus filter</span>
          <select
            value={busFilter}
            onChange={(e) => setBusFilter(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="all">All buses</option>
            {busesAz.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} · {b.plate_number}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-xs font-semibold text-electric-blue hover:bg-light-blue-30"
            >
              ← Prev
            </button>
            <p className="font-semibold text-ink">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-xs font-semibold text-electric-blue hover:bg-light-blue-30"
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={`pad-${i}`} className="min-h-14" />;
              }
              const key = dayKey(cell);
              const dayHires = hiresByDay.get(key) ?? [];
              const isSelected = sameDay(cell, selected);
              const isToday = sameDay(cell, new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(cell)}
                  className={`min-h-14 rounded-[var(--radius-sm)] border px-1 py-1 text-left transition ${
                    isSelected
                      ? "border-electric-blue bg-electric-blue text-white"
                      : dayHires.length > 0
                        ? "border-amber-300/80 bg-amber-50 hover:bg-amber-100"
                        : "border-card-border bg-white hover:bg-light-blue-30"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isSelected
                        ? "text-white"
                        : isToday
                          ? "text-electric-blue"
                          : "text-ink"
                    }`}
                  >
                    {cell.getDate()}
                  </span>
                  {dayHires.length > 0 ? (
                    <p
                      className={`mt-0.5 truncate text-[0.65rem] ${
                        isSelected ? "text-white/90" : "text-ink-muted"
                      }`}
                    >
                      {dayHires.length} hire
                      {dayHires.length === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Amber = day with booked / in-progress hire-out.
          </p>
        </div>

        <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {selected.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {hiredBuses.length} hired · {availableBuses.length} available
            {busFilter === "all" ? ` of ${buses.length}` : ""}
          </p>

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-danger">
              On hire
            </h3>
            {selectedHires.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No hire-outs this day.</p>
            ) : (
              <ul className="mt-2 divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
                {selectedHires.map((h) => (
                  <li key={h.id} className="px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{h.client_name}</p>
                    <p className="text-xs text-ink-muted">
                      {h.bus_label ?? h.bus_id.slice(0, 8)} · {h.purpose} ·{" "}
                      {h.status.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {new Date(h.start_at).toLocaleString()} →{" "}
                      {new Date(h.end_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-success">
              Free for school duty
            </h3>
            {availableBuses.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No free buses in this filter.
              </p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
                {availableBuses.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-[var(--radius-sm)] bg-success-15 px-3 py-1.5 text-ink"
                  >
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-ink-muted"> · {b.plate_number}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
