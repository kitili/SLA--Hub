"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { LiveBusMarker } from "@/components/maps/LiveBusesMap";
import { createClient } from "@/lib/supabase/client";

const LiveBusesMap = dynamic(
  () => import("@/components/maps/LiveBusesMap").then((m) => m.LiveBusesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[28rem] items-center justify-center rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 text-sm text-ink-muted">
        Loading live map…
      </div>
    ),
  },
);

type LiveBusPayload = {
  trip_id: string;
  bus_id: string;
  bus_label: string;
  bus_plate: string;
  route_id: string | null;
  direction: string;
  status: string;
  online: boolean;
  location: {
    lat: number;
    lng: number;
    recorded_at: string;
  } | null;
};

type Summary = {
  active_trips: number;
  online: number;
  offline: number;
};

// Resilience backstop, not the primary refresh mechanism -- the realtime
// subscription below refreshes immediately on a new GPS ping; this just
// catches up if that connection ever drops or misses an event.
const POLL_MS = 15_000;
// A burst of pings from several buses landing in the same second shouldn't
// trigger a separate full reload for each one.
const REALTIME_DEBOUNCE_MS = 1_000;

export function LiveMapClient() {
  const [buses, setBuses] = useState<LiveBusPayload[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  // Fallback for picking out one bus when several are clustered too close
  // together on the map for their labels to help -- clicking a row below
  // pans/zooms the map to that bus and opens its popup.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trips/live");
      const data = (await res.json()) as {
        buses?: LiveBusPayload[];
        summary?: Summary;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Failed to load live buses (${res.status})`);
        return;
      }
      setBuses(data.buses ?? []);
      setSummary(data.summary ?? null);
      setUpdatedAt(new Date().toISOString());
      setError(null);
    } catch {
      setError("Network error loading live buses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // The API hints at this exact channel (see /api/trips/live) but nothing
  // ever subscribed to it -- the map just polled. Wire it up so a new GPS
  // ping refreshes the map immediately instead of waiting up to 15s.
  useEffect(() => {
    const supabase = createClient();
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("trip_locations-live-map")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trip_locations" },
        () => {
          if (debounceId) clearTimeout(debounceId);
          debounceId = setTimeout(() => void load(), REALTIME_DEBOUNCE_MS);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      if (debounceId) clearTimeout(debounceId);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const markers: LiveBusMarker[] = buses
    .filter((b) => b.location != null)
    .map((b) => ({
      trip_id: b.trip_id,
      bus_label: b.bus_label,
      bus_plate: b.bus_plate,
      route_id: b.route_id,
      direction: b.direction,
      status: b.status,
      online: b.online,
      lat: b.location!.lat,
      lng: b.location!.lng,
      recorded_at: b.location!.recorded_at,
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        {summary ? (
          <p>
            <span className="font-semibold text-ink">{summary.active_trips}</span> active
            trips ·{" "}
            <span className="font-semibold text-success">{summary.online}</span> online ·{" "}
            <span className="font-semibold text-ink-faint">{summary.offline}</span> stale
          </p>
        ) : loading ? (
          <p>Loading…</p>
        ) : (
          <p>No summary yet.</p>
        )}
        {updatedAt ? (
          <p className="text-xs text-ink-faint">
            Updated {new Date(updatedAt).toLocaleTimeString()} ·{" "}
            {live ? "live updates on" : "polling every 15s"}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-xs font-semibold text-electric-blue hover:bg-light-blue-30"
        >
          Refresh now
        </button>
      </div>

      {error ? (
        <p className="rounded-[var(--radius-sm)] bg-danger-15 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <LiveBusesMap
        buses={markers}
        selectedTripId={selectedTripId}
        onSelectTrip={setSelectedTripId}
      />

      <ul className="divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card">
        {buses.length === 0 && !loading ? (
          <li className="px-4 py-6 text-center text-sm text-ink-muted">
            No scheduled/active trips with today&apos;s date. Start a trip and ping GPS from
            matron to see buses here.
          </li>
        ) : (
          buses.map((bus) => (
            <li key={bus.trip_id}>
              <button
                type="button"
                disabled={!bus.location}
                onClick={() => setSelectedTripId(bus.trip_id)}
                title={bus.location ? "Show on map" : "No GPS yet -- nothing to show on the map"}
                className={`flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm disabled:cursor-default ${
                  bus.trip_id === selectedTripId ? "bg-light-blue-30" : "hover:bg-light-blue-30/50"
                }`}
              >
                <div>
                  <p className="font-semibold text-ink">
                    {bus.bus_label}{" "}
                    <span className="font-normal text-ink-muted">({bus.bus_plate})</span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {bus.direction.toUpperCase()} · {bus.status}
                    {bus.location
                      ? ` · ${bus.location.lat.toFixed(5)}, ${bus.location.lng.toFixed(5)}`
                      : " · no GPS yet"}
                  </p>
                </div>
                <span
                  className={`rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold uppercase ${
                    bus.online
                      ? "bg-success-15 text-success"
                      : "bg-gray text-ink-muted"
                  }`}
                >
                  {bus.online ? "Online" : bus.location ? "Stale" : "No ping"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
