"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useActiveTrip } from "@/components/matron/ActiveTripChip";

type RosterStudent = {
  id: string;
  name: string;
  class_name: string | null;
};

type RosterPayload = {
  aboard_count: number;
  students: RosterStudent[];
  trip?: {
    capacity: number | null;
    bus_label: string;
    direction: string;
  };
  error?: string;
};

type Props = {
  tripId?: string | null;
  compact?: boolean;
};

export function BoardingHeadcount({ tripId, compact = false }: Props) {
  const active = useActiveTrip();
  const id = tripId ?? active?.tripId ?? null;
  const [data, setData] = useState<RosterPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(`/api/trips/${id}/roster`);
      const json = (await res.json()) as RosterPayload;
      if (!res.ok) {
        setError(json.error ?? "Could not load headcount");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [id]);

  useEffect(() => {
    void load();
    if (!id) return;
    const t = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(t);
  }, [id, load]);

  if (!id) {
    return (
      <div className="matron-surface p-4">
        <p className="text-sm font-semibold text-ink">On board</p>
        <p className="mt-1 text-sm text-ink-muted">
          Headcount appears once scanning starts.
        </p>
      </div>
    );
  }

  const aboard = data?.aboard_count ?? 0;
  const capacity = data?.trip?.capacity ?? null;
  const pct =
    capacity && capacity > 0
      ? Math.min(100, Math.round((aboard / capacity) * 100))
      : null;

  return (
    <section className="matron-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="matron-kicker">On board</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-electric-blue">
            {aboard}
            {capacity != null ? (
              <span className="text-base font-semibold text-ink-faint">
                {" "}
                / {capacity}
              </span>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          {pct != null ? (
            <p className="text-xs font-semibold text-ink-muted">{pct}% full</p>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 text-xs font-semibold text-electric-blue hover:underline"
          >
            {open ? "Hide list" : "Who’s aboard"}
          </button>
        </div>
      </div>

      {pct != null ? (
        <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-[var(--track)]">
          <div
            className="h-full rounded-full bg-electric-blue transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pb-3 text-xs text-danger">{error}</p>
      ) : null}

      {open && !compact ? (
        <ul className="max-h-48 divide-y divide-card-border overflow-y-auto border-t border-card-border">
          {(data?.students ?? []).length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-muted">
              Nobody scanned in yet.
            </li>
          ) : (
            [...(data?.students ?? [])]
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
              )
              .map((s) => (
              <li key={s.id}>
                <Link
                  href={`/matron/students/${s.id}`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm no-underline hover:bg-[var(--app-bg)]"
                >
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="text-xs text-ink-faint">
                    {s.class_name ?? "—"}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
