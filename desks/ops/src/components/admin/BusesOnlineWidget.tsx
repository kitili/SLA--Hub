"use client";

import { useCallback, useEffect, useState } from "react";

type LiveBus = {
  trip_id: string;
  bus_id: string;
  bus_label: string;
  bus_plate: string;
  direction: string;
  status: string;
  online: boolean;
  gps_stale?: boolean;
  ping_age_seconds?: number | null;
  departed_school_at: string | null;
  location: {
    lat: number;
    lng: number;
    recorded_at: string;
  } | null;
};

type LiveResponse = {
  buses?: LiveBus[];
  summary?: {
    active_trips: number;
    online: number;
    offline: number;
    gps_stale?: number;
  };
  error?: string;
};

function pingAge(iso: string | undefined): string {
  if (!iso) return "no ping";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function BusesOnlineWidget() {
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [summary, setSummary] = useState({
    active_trips: 0,
    online: 0,
    offline: 0,
    gps_stale: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trips/live");
      const data = (await res.json()) as LiveResponse;
      if (!res.ok) {
        setError(data.error ?? `Live feed failed (${res.status})`);
        return;
      }
      setBuses(data.buses ?? []);
      const next = data.summary ?? {
        active_trips: data.buses?.length ?? 0,
        online: (data.buses ?? []).filter((b) => b.online).length,
        offline: (data.buses ?? []).filter((b) => !b.online).length,
        gps_stale: (data.buses ?? []).filter((b) => b.gps_stale).length,
      };
      setSummary({
        active_trips: next.active_trips,
        online: next.online,
        offline: next.offline,
        gps_stale: next.gps_stale ?? 0,
      });
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch {
      setError("Network error loading live buses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Buses online now
        </h2>
        <p className="text-xs text-ink-faint">
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleTimeString()}`
            : loading
              ? "Loading…"
              : "—"}{" "}
          · polls /api/trips/live
        </p>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Online
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-success">
            {loading && !updatedAt ? "—" : summary.online}
          </p>
          <p className="mt-1 text-xs text-ink-faint">GPS ping within 90s</p>
        </article>
        <article className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Active trips
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-electric-blue">
            {loading && !updatedAt ? "—" : summary.active_trips}
          </p>
          <p className="mt-1 text-xs text-ink-faint">Scheduled or active today</p>
        </article>
        <article className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Offline / stale
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-muted">
            {loading && !updatedAt ? "—" : summary.offline}
          </p>
          <p className="mt-1 text-xs text-ink-faint">No recent ping</p>
        </article>
        <article className="rounded-[var(--radius)] border border-gold/40 bg-gold-15 p-4 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            GPS alert (&gt;2 min)
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ink">
            {loading && !updatedAt ? "—" : summary.gps_stale}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Running trip, matron phone quiet — check Scan or Path
          </p>
        </article>
      </div>

      {summary.gps_stale > 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-sm)] border border-gold/50 bg-gold-15 px-3 py-2 text-sm font-semibold text-ink"
        >
          {summary.gps_stale} bus
          {summary.gps_stale === 1 ? "" : "es"} on an active trip with no GPS
          for over 2 minutes. Keep the Matron app open on Path or Scan so the
          bus trail stays live.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
      ) : null}

      <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
        {buses.length === 0 && !loading ? (
          <li className="px-4 py-6 text-center text-sm text-ink-muted">
            No active trips with live status right now.
          </li>
        ) : (
          buses.map((bus) => (
            <li
              key={bus.trip_id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-ink">
                  {bus.bus_label || "Bus"}{" "}
                  <span className="font-normal text-ink-muted">
                    · {bus.bus_plate}
                  </span>
                </p>
                <p className="text-xs text-ink-faint">
                  {bus.direction.toUpperCase()} · {bus.status}
                  {bus.departed_school_at ? " · left school" : ""}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold uppercase ${
                    bus.gps_stale
                      ? "bg-gold-15 text-ink"
                      : bus.online
                        ? "bg-success-15 text-success"
                        : "bg-light-blue-30 text-ink-muted"
                  }`}
                >
                  {bus.gps_stale
                    ? "GPS stale"
                    : bus.online
                      ? "Online"
                      : "Offline"}
                </span>
                <p className="mt-1 text-xs text-ink-faint">
                  {pingAge(bus.location?.recorded_at)}
                  {bus.location
                    ? ` · ${bus.location.lat.toFixed(4)}, ${bus.location.lng.toFixed(4)}`
                    : ""}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
