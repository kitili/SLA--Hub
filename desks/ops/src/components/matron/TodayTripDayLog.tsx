"use client";

import { useMemo, useState } from "react";
import { sortTripsTodayByBus } from "@/lib/sort/alphabetical";

export type DayTripSummary = {
  id: string;
  bus_label: string;
  bus_plate: string;
  direction: string;
  status: string;
  started_at: string | null;
  departed_school_at: string | null;
  ended_at: string | null;
  last_ping_at: string | null;
  matron_name: string | null;
};

type Props = {
  trips: DayTripSummary[];
  tripDate: string;
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  // Pin locale + hour12 explicitly — leaving these to the ambient default
  // resolves differently between Node (SSR) and the browser (hydration),
  // which was causing a real hydration mismatch (server "13:00" vs
  // client "01:00 PM" for the same timestamp).
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusTone(status: string) {
  if (status === "active") return "bg-success-15 text-success";
  if (status === "completed") return "bg-light-blue-30 text-electric-blue";
  if (status === "cancelled") return "bg-danger-15 text-danger";
  return "bg-gold-15 text-ink";
}

export function TodayTripDayLog({ trips, tripDate }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => sortTripsTodayByBus(trips), [trips]);

  const activeCount = trips.filter((t) => t.status === "active").length;
  const doneCount = trips.filter((t) => t.status === "completed").length;

  return (
    <section className="ui-rise ui-rise-delay-1 mt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Live day log
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-electric-blue">
            Start &amp; stop today
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            From trip records + last GPS ping · {tripDate}
          </p>
        </div>
        <p className="text-xs font-semibold text-ink-faint">
          {activeCount} live · {doneCount} ended
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius)] border border-dashed border-card-border bg-white/60 px-4 py-8 text-center text-sm text-ink-muted">
          No trips started today yet. When matrons start AM/PM, start and stop
          times appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-card-border/80 overflow-hidden rounded-[1.1rem] border border-card-border bg-white/90 shadow-[var(--shadow)]">
          {sorted.map((trip) => {
            const open = expandedId === trip.id;
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : trip.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-light-blue-30/40"
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-ink">
                      {trip.bus_label}{" "}
                      <span className="font-semibold text-electric-blue">
                        · {trip.direction.toUpperCase()}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Start {fmtTime(trip.started_at)} · End{" "}
                      {fmtTime(trip.ended_at)}
                      {trip.last_ping_at
                        ? ` · Ping ${fmtTime(trip.last_ping_at)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusTone(trip.status)}`}
                  >
                    {trip.status}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-card-border/60 bg-light-blue-30/30 px-4 py-3 text-sm">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Bus
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {trip.bus_label}
                          {trip.bus_plate && trip.bus_plate !== "TBA"
                            ? ` · ${trip.bus_plate}`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Matron
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {trip.matron_name ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Started
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {fmtDateTime(trip.started_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Left school
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {fmtDateTime(trip.departed_school_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Ended
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {trip.ended_at
                            ? new Date(trip.ended_at).toLocaleString()
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-ink-faint">
                          Last GPS ping
                        </dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {trip.last_ping_at
                            ? new Date(trip.last_ping_at).toLocaleString()
                            : "No ping yet"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
