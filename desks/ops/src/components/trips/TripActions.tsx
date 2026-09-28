"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TripDirection, TripStatus, TripWithBus } from "@/types/database";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type Props = {
  busId: string;
  busLabel: string;
  busCapacity: number;
  trips: TripWithBus[];
};

const STATUS_STYLES: Record<TripStatus, string> = {
  scheduled: "bg-light-blue-30 text-electric-blue",
  active: "bg-success-15 text-success",
  completed: "bg-card text-ink-muted",
  cancelled: "bg-danger-15 text-danger",
};

function DirectionStatus({
  trip,
  label,
  busCapacity,
}: {
  trip: TripWithBus;
  label: string;
  busCapacity: number;
}) {
  return (
    <span
      className={`rounded-[var(--radius-sm)] px-3 py-2 text-xs font-semibold uppercase ${STATUS_STYLES[trip.status]}`}
    >
      {label} · {trip.status} · {trip.aboard_count}/{busCapacity}
    </span>
  );
}

export function TripActions({ busId, busLabel, busCapacity, trips }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [loading, setLoading] = useState<TripDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<TripDirection | null>(null);

  const amTrip = trips.find((t) => t.direction === "am") ?? null;
  const pmTrip = trips.find((t) => t.direction === "pm") ?? null;

  useEffect(() => {
    if (!justCreated) return;
    const timer = setTimeout(() => setJustCreated(null), 3000);
    return () => clearTimeout(timer);
  }, [justCreated]);

  async function create(direction: TripDirection) {
    const ok = await confirm({
      title: "Create trip?",
      message: `Create the ${direction.toUpperCase()} trip for ${busLabel}?`,
      confirmLabel: "Create",
      tone: "default",
    });
    if (!ok) return;

    setLoading(direction);
    setError(null);

    let res: Response;
    try {
      res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busId, direction }),
      });
    } catch {
      setError("Network error — check your connection and try again.");
      setLoading(null);
      return;
    }

    let data: { error?: string } = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON response body — fall through, res.ok/status still drive the message below.
    }

    if (!res.ok) {
      setError(data.error ?? `Server error (${res.status}). Try again.`);
      setLoading(null);
      return;
    }

    setLoading(null);
    setJustCreated(direction);
    router.refresh();
  }

  return (
    <>
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {amTrip ? (
          <DirectionStatus trip={amTrip} label="AM" busCapacity={busCapacity} />
        ) : (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => create("am")}
            className="rounded-full bg-electric-blue px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-electric-blue/20 transition hover:brightness-110 disabled:cursor-wait disabled:brightness-95"
          >
            {loading === "am" ? "…" : "AM trip"}
          </button>
        )}
        {pmTrip ? (
          <DirectionStatus trip={pmTrip} label="PM" busCapacity={busCapacity} />
        ) : (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => create("pm")}
            className="rounded-full border border-electric-blue/25 bg-white/70 px-3.5 py-2 text-xs font-semibold text-electric-blue transition hover:bg-white disabled:cursor-wait"
          >
            {loading === "pm" ? "…" : "PM trip"}
          </button>
        )}
      </div>
      {error ? (
        <p className="max-w-xs text-right text-xs text-danger" role="alert">
          {busLabel}: {error}
        </p>
      ) : null}
      {justCreated && !error ? (
        <p className="max-w-xs text-right text-xs text-success" role="status">
          {justCreated.toUpperCase()} trip created.
        </p>
      ) : null}
    </div>
    {dialog}
    </>
  );
}
