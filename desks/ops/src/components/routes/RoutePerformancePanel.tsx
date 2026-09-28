"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  estimateEtaOffsetsMinutes,
  measurePathKm,
  type OptimizePoint,
} from "@/lib/routing/optimize";
import { useConfirm } from "@/components/admin/ConfirmDialog";

const StopsMap = dynamic(
  () => import("@/components/maps/StopsMap").then((m) => m.StopsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[22rem] items-center justify-center rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 text-sm text-ink-muted">
        Loading map…
      </div>
    ),
  },
);

type RouteOption = {
  id: string;
  name: string;
  direction: string;
};

type RouteStopRow = {
  order: number;
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  eta_offset_minutes: number | null;
};

type PerformanceSnapshot = {
  distance_km: number;
  duration_min: number;
  stops: RouteStopRow[];
};

type Props = {
  routes: RouteOption[];
  /** Prefetch / highlight this route (e.g. Majundo demo seed). */
  defaultRouteId?: string;
};

function pointsFromStops(stops: RouteStopRow[]): OptimizePoint[] {
  return stops
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      lat: s.lat ?? NaN,
      lng: s.lng ?? NaN,
      kind: s.kind,
    }));
}

function snapshotFromStops(stops: RouteStopRow[]): PerformanceSnapshot {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  const points = pointsFromStops(ordered);
  const withCoords = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const distance_km = measurePathKm(points);
  const offsets = estimateEtaOffsetsMinutes(withCoords);
  const duration_min =
    offsets.length > 0
      ? offsets[offsets.length - 1]
      : ordered.reduce(
          (max, s) => Math.max(max, s.eta_offset_minutes ?? 0),
          0,
        );
  return { distance_km, duration_min, stops: ordered };
}

export function RoutePerformancePanel({
  routes,
  defaultRouteId,
}: Props) {
  const initialId =
    defaultRouteId && routes.some((r) => r.id === defaultRouteId)
      ? defaultRouteId
      : (routes[0]?.id ?? "");

  const [routeId, setRouteId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [before, setBefore] = useState<PerformanceSnapshot | null>(null);
  const [after, setAfter] = useState<PerformanceSnapshot | null>(null);
  const [mapStops, setMapStops] = useState<RouteStopRow[]>([]);
  const { confirm, dialog } = useConfirm();

  const loadRoute = useCallback(async (id: string) => {
    if (!id) {
      setBefore(null);
      setAfter(null);
      setMapStops([]);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setAfter(null);
    try {
      const res = await fetch(`/api/routes/${id}`);
      const data = (await res.json()) as {
        stops?: RouteStopRow[];
        error?: string;
      };
      if (!res.ok || !data.stops) {
        setError(data.error ?? `Failed to load route (${res.status})`);
        setBefore(null);
        setMapStops([]);
        return;
      }
      const snap = snapshotFromStops(data.stops);
      setBefore(snap);
      setMapStops(snap.stops);
    } catch {
      setError("Network error loading route");
      setBefore(null);
      setMapStops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoute(routeId);
  }, [routeId, loadRoute]);

  async function runOptimize() {
    if (!routeId) {
      setError("Select a route");
      return;
    }
    const route = routes.find((r) => r.id === routeId);
    const stopCount = (before?.stops ?? mapStops).length;
    const ok = await confirm({
      title: "Optimize this route?",
      message: `Optimize "${route?.name ?? "this route"}"${
        stopCount > 0 ? ` (${stopCount} stops)` : ""
      }? This overwrites the currently saved stop order with the optimized order.`,
      confirmLabel: "Optimize",
    });
    if (!ok) return;
    setOptimizing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as {
        before_km?: number;
        distance_km?: number;
        km_saved?: number;
        stops?: {
          order: number;
          id: string;
          name: string;
          eta_offset_minutes: number | null;
        }[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError(
          data.error
            ? `${data.error}${data.hint ? ` — ${data.hint}` : ""}`
            : `Optimize failed (${res.status})`,
        );
        return;
      }

      // Merge optimize order/ETAs onto current lat/lng from before snapshot
      const byId = new Map((before?.stops ?? mapStops).map((s) => [s.id, s]));
      const optimizedStops: RouteStopRow[] = (data.stops ?? []).map((s) => {
        const prev = byId.get(s.id);
        return {
          order: s.order,
          id: s.id,
          name: s.name,
          kind: prev?.kind ?? "pickup",
          lat: prev?.lat ?? null,
          lng: prev?.lng ?? null,
          eta_offset_minutes: s.eta_offset_minutes,
        };
      });
      const afterSnap = snapshotFromStops(optimizedStops);
      // Prefer API distance when present
      if (typeof data.distance_km === "number") {
        afterSnap.distance_km = data.distance_km;
      }
      if (before && typeof data.before_km === "number") {
        setBefore({ ...before, distance_km: data.before_km });
      }
      setAfter(afterSnap);
      setMapStops(afterSnap.stops);
      setMessage(
        `Optimized — saved ${(data.km_saved ?? Math.max(0, (before?.distance_km ?? 0) - afterSnap.distance_km)).toFixed(1)} km`,
      );
    } catch {
      setError("Network error during optimize");
    } finally {
      setOptimizing(false);
    }
  }

  const mapPoints = useMemo(
    () =>
      mapStops.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        lat: s.lat,
        lng: s.lng,
      })),
    [mapStops],
  );

  const kmDelta =
    before && after
      ? Math.max(0, before.distance_km - after.distance_km)
      : null;
  const minDelta =
    before && after
      ? Math.max(0, before.duration_min - after.duration_min)
      : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Map + route performance
          </h2>
          <p className="mt-1 max-w-xl text-xs text-ink-faint">
            Distance and estimated time before / after{" "}
            <code>POST /api/routes/[id]/optimize</code>. Polyline follows stop
            order (Leaflet).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Route</span>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {routes.length === 0 ? (
                <option value="">No routes</option>
              ) : (
                routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.direction.toUpperCase()})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="rounded border-card-border"
            />
            Force if over capacity
          </label>
          <button
            type="button"
            onClick={() => void runOptimize()}
            disabled={optimizing || loading || !routeId}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {optimizing ? "Optimizing…" : "Optimize & compare"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm font-semibold text-success">{message}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Before distance"
          value={
            before ? `${before.distance_km.toFixed(1)} km` : loading ? "…" : "—"
          }
        />
        <MetricTile
          label="After distance"
          value={after ? `${after.distance_km.toFixed(1)} km` : "—"}
          accent={after ? "success" : undefined}
        />
        <MetricTile
          label="Before time (est.)"
          value={
            before ? `${before.duration_min} min` : loading ? "…" : "—"
          }
        />
        <MetricTile
          label="After time (est.)"
          value={after ? `${after.duration_min} min` : "—"}
          accent={after ? "success" : undefined}
        />
      </div>

      {kmDelta != null && minDelta != null ? (
        <p className="mt-3 text-sm text-ink-muted">
          Saved{" "}
          <span className="font-semibold text-success">
            {kmDelta.toFixed(1)} km
          </span>{" "}
          · ~{" "}
          <span className="font-semibold text-success">{minDelta} min</span>{" "}
          (static ETA model: ~2.5 min/km + dwell).
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-faint">
          Load a route to see current path metrics, then optimize to compare.
        </p>
      )}

      <div className="mt-4">
        <StopsMap stops={mapPoints} showPolyline height="24rem" />
      </div>

      {mapStops.length > 0 ? (
        <ol className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card text-sm shadow-[var(--shadow)]">
          {mapStops.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
            >
              <span className="font-semibold text-ink">
                {s.order + 1}. {s.name}
              </span>
              <span className="text-xs text-ink-muted">
                {s.kind}
                {s.eta_offset_minutes != null
                  ? ` · ETA +${s.eta_offset_minutes}m`
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {dialog}
    </section>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success";
}) {
  return (
    <article className="rounded-[var(--radius)] border border-card-border bg-card px-3 py-3 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${
          accent === "success" ? "text-success" : "text-electric-blue"
        }`}
      >
        {value}
      </p>
    </article>
  );
}
