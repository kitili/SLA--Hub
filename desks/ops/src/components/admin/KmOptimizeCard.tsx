"use client";

import { useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type RouteOption = {
  id: string;
  name: string;
  direction: string;
};

type OptimizeResult = {
  before_km: number;
  distance_km: number;
  km_saved: number;
  route_name?: string;
  forced?: boolean;
  error?: string;
  capacity?: { over_capacity?: boolean };
};

type Props = {
  routes: RouteOption[];
};

export function KmOptimizeCard({ routes }: Props) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function runOptimize() {
    if (!routeId) {
      setError("Select a route");
      return;
    }
    const selectedRoute = routes.find((route) => route.id === routeId);
    const ok = await confirm({
      title: "Run route optimize?",
      message: `Optimize stop order for "${selectedRoute ? `${selectedRoute.name} (${selectedRoute.direction.toUpperCase()})` : "the selected route"}"? This overwrites its current stop order${force ? " and will force-save even if over capacity" : ""}.`,
      confirmLabel: "Run optimize",
    });
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as OptimizeResult & {
        hint?: string;
        code?: string;
      };
      if (!res.ok) {
        setResult(null);
        setError(
          data.error
            ? `${data.error}${data.hint ? ` — ${data.hint}` : ""}`
            : `Optimize failed (${res.status})`,
        );
        return;
      }
      setResult({
        before_km: data.before_km,
        distance_km: data.distance_km,
        km_saved: data.km_saved,
        route_name: data.route_name,
        forced: data.forced,
      });
    } catch {
      setResult(null);
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)] sm:col-span-2 lg:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Route optimize · km KPI
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Before / after distance from{" "}
        <code className="text-[0.7rem]">POST /api/routes/[id]/optimize</code>
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Route</span>
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setResult(null);
              setError(null);
            }}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            {routes.length === 0 ? (
              <option value="">No routes</option>
            ) : (
              routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name} ({route.direction.toUpperCase()})
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
          disabled={loading || !routeId}
          className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {loading ? "Optimizing…" : "Run optimize"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-danger">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-sm)] bg-light-blue-30 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Before
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-electric-blue">
              {result.before_km.toFixed(1)}
              <span className="ml-1 text-sm font-semibold">km</span>
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-light-blue-30 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              After
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-electric-blue">
              {result.distance_km.toFixed(1)}
              <span className="ml-1 text-sm font-semibold">km</span>
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-success-15 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Saved
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-success">
              {result.km_saved.toFixed(1)}
              <span className="ml-1 text-sm font-semibold">km</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 font-display text-3xl font-bold text-electric-blue">
          —
        </p>
      )}

      {result?.route_name ? (
        <p className="mt-2 text-xs text-ink-faint">
          {result.route_name}
          {result.forced ? " · forced save (over capacity)" : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">
          Pick a route and run optimize to populate before/after km.
        </p>
      )}
      {dialog}
    </article>
  );
}
