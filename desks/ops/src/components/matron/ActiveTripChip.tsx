"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadActiveTrip,
  type ActiveTrip,
} from "@/lib/matron/active-trip";

/** Syncs across tabs/pages when trip starts/clears in the same session. */
export function useActiveTrip() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);

  useEffect(() => {
    function refresh() {
      setTrip(loadActiveTrip());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("matron-active-trip", refresh);
    const id = window.setInterval(refresh, 4000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("matron-active-trip", refresh);
      window.clearInterval(id);
    };
  }, []);

  return trip;
}

export function notifyActiveTripChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("matron-active-trip"));
}

export function ActiveTripChip() {
  const trip = useActiveTrip();
  if (!trip) return null;

  const href = trip.tripId
    ? `/matron/scan?tripId=${trip.tripId}`
    : `/matron/students?busId=${trip.busId}`;

  return (
    <Link
      href={href}
      className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-card-border bg-[var(--app-bg)] px-2.5 py-1.5 no-underline transition hover:border-electric-blue/30 sm:max-w-none"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
        aria-hidden
      />
      <span className="min-w-0 truncate text-[11px] font-semibold text-electric-blue">
        {trip.busLabel}
        {trip.direction ? ` · ${trip.direction.toUpperCase()}` : ""}
      </span>
    </Link>
  );
}
