"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { Stop, StopKind, TripDirection } from "@/types/database";
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

export type BuilderStop = {
  id: string;
  name: string;
  kind: StopKind;
  lat: number | null;
  lng: number | null;
  order: number;
  eta_offset_minutes: number | null;
};

type Capacity = {
  assigned_students: number;
  bus_capacity_total: number;
  over_capacity: boolean;
};

type Props = {
  routeId: string;
  routeName: string;
  direction: TripDirection;
  schoolId: string;
  initialStops: BuilderStop[];
  availableStops: Stop[];
  capacity: Capacity;
};

type OptimizeResult = {
  distance_km: number;
  before_km: number;
  km_saved: number;
  stops: { order: number; id: string; name: string; eta_offset_minutes: number | null }[];
};

export function RouteBuilderClient({
  routeId,
  routeName,
  direction,
  schoolId,
  initialStops,
  availableStops,
  capacity: initialCapacity,
}: Props) {
  const [stops, setStops] = useState<BuilderStop[]>(
    () => [...initialStops].sort((a, b) => a.order - b.order),
  );
  const [capacity, setCapacity] = useState(initialCapacity);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizeMeta, setOptimizeMeta] = useState<OptimizeResult | null>(null);
  const [showPolyline, setShowPolyline] = useState(true);

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<StopKind>("pickup");
  const [pendingLat, setPendingLat] = useState<number | null>(null);
  const [pendingLng, setPendingLng] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [poolStopId, setPoolStopId] = useState("");

  const { confirm, dialog } = useConfirm();

  const pool = useMemo(() => {
    const onRoute = new Set(stops.map((s) => s.id));
    return availableStops.filter((s) => !onRoute.has(s.id));
  }, [availableStops, stops]);

  const mapStops = useMemo(
    () =>
      stops.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        lat: s.lat,
        lng: s.lng,
      })),
    [stops],
  );

  const renumber = useCallback((list: BuilderStop[]) => {
    return list.map((s, i) => ({ ...s, order: i }));
  }, []);

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setStops((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      setDragIndex(index);
      return renumber(next);
    });
  }

  function onDragEnd() {
    setDragIndex(null);
  }

  function moveStop(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    setStops((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return renumber(next);
    });
  }

  function removeStop(index: number) {
    setStops((prev) => renumber(prev.filter((_, i) => i !== index)));
  }

  async function saveOrder() {
    const ok = await confirm({
      title: "Save stop order?",
      message: `Save the new order for all ${stops.length} stop${stops.length === 1 ? "" : "s"} on "${routeName}"? This overwrites the order currently saved for this route.`,
      confirmLabel: "Save order",
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/stops`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: stops.map((s, i) => ({
            stopId: s.id,
            order: i,
            etaOffsetMinutes: s.eta_offset_minutes,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save stop order");
        return;
      }
      setMessage("Stop order saved.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function runOptimize(force = false) {
    const ok = await confirm({
      title: force ? "Force optimize route?" : "Optimize route?",
      message: force
        ? `Recalculate stop order for "${routeName}" and overwrite the current order, even though the route is over capacity (${capacity.assigned_students} students vs ${capacity.bus_capacity_total} seats)?`
        : `Recalculate the shortest stop order for "${routeName}" (${stops.length} stops) and overwrite the current order?`,
      confirmLabel: force ? "Force optimize" : "Optimize",
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
      const data = (await res.json()) as OptimizeResult & {
        error?: string;
        code?: string;
        capacity?: Capacity;
        hint?: string;
      };

      if (data.capacity) setCapacity(data.capacity);

      if (!res.ok) {
        if (data.code === "over_capacity") {
          setError(
            `${data.error ?? "Over capacity"}. ${data.hint ?? "Use Force optimize to save anyway."}`,
          );
        } else {
          setError(data.error ?? "Optimize failed");
        }
        return;
      }

      const byId = new Map(stops.map((s) => [s.id, s]));
      const next: BuilderStop[] = data.stops.map((s) => {
        const prev = byId.get(s.id);
        return {
          id: s.id,
          name: s.name,
          kind: prev?.kind ?? "pickup",
          lat: prev?.lat ?? null,
          lng: prev?.lng ?? null,
          order: s.order,
          eta_offset_minutes: s.eta_offset_minutes,
        };
      });
      setStops(renumber(next));
      setOptimizeMeta({
        distance_km: data.distance_km,
        before_km: data.before_km,
        km_saved: data.km_saved,
        stops: data.stops,
      });
      setShowPolyline(true);
      setMessage(
        `Optimized — saved ${data.km_saved.toFixed(1)} km (before ${data.before_km.toFixed(1)} → ${data.distance_km.toFixed(1)}).`,
      );
    } catch {
      setError("Network error while optimizing.");
    } finally {
      setOptimizing(false);
    }
  }

  async function addExistingStop() {
    if (!poolStopId) return;
    const stop = pool.find((s) => s.id === poolStopId);
    if (!stop) return;
    setStops((prev) =>
      renumber([
        ...prev,
        {
          id: stop.id,
          name: stop.name,
          kind: stop.kind,
          lat: stop.lat,
          lng: stop.lng,
          order: prev.length,
          eta_offset_minutes: null,
        },
      ]),
    );
    setPoolStopId("");
  }

  async function createAndAddStop() {
    if (!newName.trim() || !schoolId) {
      setError("Stop name required (and school must have existing stops or route school).");
      return;
    }
    const ok = await confirm({
      title: "Create new stop?",
      message: `Create a new ${newKind} stop named "${newName.trim()}" and add it to "${routeName}"?`,
      confirmLabel: "Create stop",
    });
    if (!ok) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: newName.trim(),
          kind: newKind,
          lat: pendingLat,
          lng: pendingLng,
        }),
      });
      const data = (await res.json()) as { stop?: Stop; error?: string };
      if (!res.ok || !data.stop) {
        setError(data.error ?? "Failed to create stop");
        return;
      }
      const stop = data.stop;
      setStops((prev) =>
        renumber([
          ...prev,
          {
            id: stop.id,
            name: stop.name,
            kind: stop.kind,
            lat: stop.lat,
            lng: stop.lng,
            order: prev.length,
            eta_offset_minutes: null,
          },
        ]),
      );
      setNewName("");
      setPendingLat(null);
      setPendingLng(null);
      setMessage(`Added stop “${stop.name}”. Save order when ready.`);
    } catch {
      setError("Network error creating stop.");
    } finally {
      setAdding(false);
    }
  }

  function exportCsv() {
    const header = "order,name,kind,lat,lng,eta_offset_minutes";
    const lines = stops.map(
      (s) =>
        `${s.order + 1},"${s.name.replace(/"/g, '""')}",${s.kind},${s.lat ?? ""},${s.lng ?? ""},${s.eta_offset_minutes ?? ""}`,
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${routeName.replace(/\s+/g, "-").toLowerCase()}-stops.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSheet() {
    const rows = stops
      .map(
        (s) =>
          `<tr><td>${s.order + 1}</td><td>${escapeHtml(s.name)}</td><td>${s.kind}</td><td>${s.eta_offset_minutes ?? "—"}</td><td>${s.lat != null && s.lng != null ? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}` : "—"}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(routeName)} — stop sheet</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#14233b}
        h1{font-size:20px;margin:0 0 4px}
        p{margin:0 0 16px;color:#4f555f;font-size:13px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #c5d0de;padding:8px 10px;text-align:left;font-size:13px}
        th{background:#d9ecf9}
      </style></head><body>
      <h1>${escapeHtml(routeName)} (${direction.toUpperCase()})</h1>
      <p>Driver / matron stop sheet · ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>#</th><th>Stop</th><th>Kind</th><th>ETA offset (min)</th><th>Coords</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      setError("Popup blocked — allow popups to print the stop sheet.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const missingCoords = stops.filter((s) => s.lat == null || s.lng == null).length;

  return (
    <div className="flex flex-col gap-6">
      {capacity.over_capacity ? (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm text-danger"
        >
          Route capacity alarm: {capacity.assigned_students} students assigned vs{" "}
          {capacity.bus_capacity_total} seats on linked buses.
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-sm)] bg-danger-15 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-[var(--radius-sm)] bg-success-15 px-3 py-2 text-sm text-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveOrder()}
          disabled={saving}
          className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save order"}
        </button>
        <button
          type="button"
          onClick={() => void runOptimize(false)}
          disabled={optimizing || stops.length < 2}
          className="rounded-[var(--radius-sm)] border border-electric-blue/30 bg-white px-4 py-2 text-sm font-semibold text-electric-blue hover:bg-light-blue-30 disabled:opacity-60"
        >
          {optimizing ? "Optimizing…" : "Optimize route"}
        </button>
        {capacity.over_capacity ? (
          <button
            type="button"
            onClick={() => void runOptimize(true)}
            disabled={optimizing}
            className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-4 py-2 text-sm font-semibold text-danger hover:brightness-95 disabled:opacity-60"
          >
            Force optimize
          </button>
        ) : null}
        <button
          type="button"
          onClick={exportCsv}
          disabled={stops.length === 0}
          className="rounded-[var(--radius-sm)] border border-card-border bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-light-blue-30 disabled:opacity-60"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={printSheet}
          disabled={stops.length === 0}
          className="rounded-[var(--radius-sm)] border border-card-border bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-light-blue-30 disabled:opacity-60"
        >
          Print stop sheet
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={showPolyline}
            onChange={(e) => setShowPolyline(e.target.checked)}
          />
          Show polyline
        </label>
      </div>

      {optimizeMeta ? (
        <p className="text-sm text-ink-muted">
          Last optimize: {optimizeMeta.before_km.toFixed(1)} km →{" "}
          {optimizeMeta.distance_km.toFixed(1)} km (saved{" "}
          {optimizeMeta.km_saved.toFixed(1)} km). Polyline follows optimized order.
        </p>
      ) : null}

      {missingCoords > 0 ? (
        <p className="text-xs text-ink-faint">
          {missingCoords} stop{missingCoords === 1 ? "" : "s"} missing coordinates —
          polyline / optimize use stops that have lat/lng.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Stops (drag to reorder)
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {stops.map((stop, index) => (
              <li
                key={stop.id}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragEnd={onDragEnd}
                className={`flex cursor-grab items-center gap-2 rounded-[var(--radius-sm)] border border-card-border bg-light-blue-30 px-3 py-2 active:cursor-grabbing ${
                  dragIndex === index ? "opacity-70 ring-2 ring-electric-blue/40" : ""
                }`}
              >
                <span className="w-6 shrink-0 text-center text-xs font-bold text-electric-blue">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{stop.name}</p>
                  <p className="text-xs text-ink-faint">
                    {stop.kind}
                    {stop.lat != null && stop.lng != null
                      ? ` · ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`
                      : " · no coords"}
                    {stop.eta_offset_minutes != null
                      ? ` · ETA +${stop.eta_offset_minutes}m`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => moveStop(index, -1)}
                    className="rounded px-2 py-1 text-xs font-semibold text-electric-blue hover:bg-white"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => moveStop(index, 1)}
                    className="rounded px-2 py-1 text-xs font-semibold text-electric-blue hover:bg-white"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from route"
                    onClick={() => removeStop(index)}
                    className="rounded px-2 py-1 text-xs font-semibold text-danger hover:bg-white"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
            {stops.length === 0 ? (
              <li className="text-sm text-ink-faint">No stops on this route yet.</li>
            ) : null}
          </ol>
        </section>

        <StopsMap
          stops={mapStops}
          showPolyline={showPolyline}
          onMapClick={(lat, lng) => {
            setPendingLat(lat);
            setPendingLng(lng);
          }}
        />
      </div>

      <section className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Add stops
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">From stop pool</span>
            <select
              value={poolStopId}
              onChange={(e) => setPoolStopId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">Select stop…</option>
              {pool.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void addExistingStop()}
            disabled={!poolStopId}
            className="rounded-[var(--radius-sm)] border border-electric-blue/30 bg-white px-4 py-2 text-sm font-semibold text-electric-blue hover:bg-light-blue-30 disabled:opacity-60"
          >
            Add to route
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-card-border pt-4">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">New stop name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Market Gate"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Kind</span>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as StopKind)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="pickup">pickup</option>
              <option value="dropoff">dropoff</option>
              <option value="school">school</option>
              <option value="waypoint">waypoint</option>
            </select>
          </label>
          <p className="text-xs text-ink-muted">
            Coords:{" "}
            {pendingLat != null && pendingLng != null
              ? `${pendingLat.toFixed(5)}, ${pendingLng.toFixed(5)}`
              : "click map (optional)"}
          </p>
          <button
            type="button"
            onClick={() => void createAndAddStop()}
            disabled={adding || !newName.trim() || !schoolId}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {adding ? "Adding…" : "Create & add"}
          </button>
        </div>
        {!schoolId ? (
          <p className="mt-2 text-xs text-danger">
            Cannot create stops — no school context (add at least one campus stop via seed, or open a route that already has stops).
          </p>
        ) : null}
      </section>
      {dialog}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
