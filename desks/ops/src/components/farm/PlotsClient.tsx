"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type {
  FarmCropPlanting,
  FarmPlot,
  PlantingStatus,
  PlotStatus,
} from "@/lib/db/farm";

const PLOT_STATUSES: PlotStatus[] = ["fallow", "staged", "active", "retired"];

const PLANTING_STATUSES: PlantingStatus[] = [
  "planned",
  "planted",
  "growing",
  "harvested",
  "failed",
];

type Props = {
  initialPlots: FarmPlot[];
  initialPlantings: FarmCropPlanting[];
};

function plotStatusClass(status: PlotStatus): string {
  switch (status) {
    case "active":
      return "text-success";
    case "retired":
      return "text-ink-faint";
    default:
      return "text-ink-muted";
  }
}

export function PlotsClient({ initialPlots, initialPlantings }: Props) {
  const router = useRouter();
  const [plots, setPlots] = useState(initialPlots);
  const [plantings, setPlantings] = useState(initialPlantings);

  // Plot form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [acreage, setAcreage] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<PlotStatus>("fallow");
  const [notes, setNotes] = useState("");
  const [plotSaving, setPlotSaving] = useState(false);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);

  // Planting form
  const [plantingPlotId, setPlantingPlotId] = useState(plots[0]?.id ?? "");
  const [crop, setCrop] = useState("");
  const [season, setSeason] = useState("");
  const [plantedOn, setPlantedOn] = useState("");
  const [expectedHarvestOn, setExpectedHarvestOn] = useState("");
  const [targetYieldKg, setTargetYieldKg] = useState("");
  const [plantingStatus, setPlantingStatus] =
    useState<PlantingStatus>("planned");
  const [plantingNotes, setPlantingNotes] = useState("");
  const [plantingSaving, setPlantingSaving] = useState(false);
  const [plantingError, setPlantingError] = useState<string | null>(null);
  const [editingPlantingId, setEditingPlantingId] = useState<string | null>(null);

  function resetPlotForm() {
    setEditingPlotId(null);
    setCode("");
    setName("");
    setAcreage("");
    setLocation("");
    setStatus("fallow");
    setNotes("");
  }

  function startEditPlot(p: FarmPlot) {
    setEditingPlotId(p.id);
    setCode(p.code);
    setName(p.name ?? "");
    setAcreage(String(p.acreage));
    setLocation(p.location ?? "");
    setStatus(p.status);
    setNotes(p.notes ?? "");
    setPlotError(null);
  }

  async function deletePlotRow(id: string) {
    if (!confirm("Delete this plot and its plantings?")) return;
    const res = await fetch(`/api/farm/plots/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setPlotError(data.error ?? "Delete failed");
      return;
    }
    setPlots((prev) => prev.filter((p) => p.id !== id));
    setPlantings((prev) => prev.filter((pl) => pl.plot_id !== id));
    if (editingPlotId === id) resetPlotForm();
    router.refresh();
  }

  async function submitPlot(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() && !editingPlotId) {
      setPlotError("Plot code is required.");
      return;
    }
    setPlotSaving(true);
    setPlotError(null);
    try {
      const isEdit = Boolean(editingPlotId);
      const res = await fetch(
        isEdit ? `/api/farm/plots/${editingPlotId}` : "/api/farm/plots",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  name: name.trim() || null,
                  acreage: acreage ? Number(acreage) : undefined,
                  location: location.trim() || null,
                  status,
                  notes: notes.trim() || null,
                }
              : {
                  code: code.trim(),
                  name: name.trim() || undefined,
                  acreage: acreage ? Number(acreage) : undefined,
                  location: location.trim() || undefined,
                  status,
                  notes: notes.trim() || undefined,
                },
          ),
        },
      );
      const data = (await res.json()) as { plot?: FarmPlot; error?: string };
      if (!res.ok || !data.plot) {
        setPlotError(data.error ?? "Failed to save plot");
        return;
      }
      setPlots((prev) =>
        isEdit
          ? prev.map((p) => (p.id === data.plot!.id ? data.plot! : p)).sort((a, b) => a.code.localeCompare(b.code))
          : [...prev, data.plot!].sort((a, b) => a.code.localeCompare(b.code)),
      );
      resetPlotForm();
      router.refresh();
    } catch {
      setPlotError("Network error.");
    } finally {
      setPlotSaving(false);
    }
  }

  async function changePlotStatus(id: string, nextStatus: PlotStatus) {
    setPlots((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)),
    );
    try {
      const res = await fetch(`/api/farm/plots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json()) as { plot?: FarmPlot; error?: string };
      if (!res.ok || !data.plot) {
        setPlotError(data.error ?? "Failed to update plot status");
        return;
      }
      setPlots((prev) => prev.map((p) => (p.id === id ? data.plot! : p)));
      router.refresh();
    } catch {
      setPlotError("Network error.");
    }
  }

  function resetPlantingForm() {
    setEditingPlantingId(null);
    setPlantingPlotId(plots[0]?.id ?? "");
    setCrop("");
    setSeason("");
    setPlantedOn("");
    setExpectedHarvestOn("");
    setTargetYieldKg("");
    setPlantingStatus("planned");
    setPlantingNotes("");
  }

  function startEditPlanting(pl: FarmCropPlanting) {
    setEditingPlantingId(pl.id);
    setPlantingPlotId(pl.plot_id);
    setCrop(pl.crop);
    setSeason(pl.season ?? "");
    setPlantedOn(pl.planted_on ?? "");
    setExpectedHarvestOn(pl.expected_harvest_on ?? "");
    setTargetYieldKg(pl.target_yield_kg != null ? String(pl.target_yield_kg) : "");
    setPlantingStatus(pl.status);
    setPlantingNotes(pl.notes ?? "");
    setPlantingError(null);
  }

  async function deletePlantingRow(id: string) {
    if (!confirm("Delete this planting?")) return;
    const res = await fetch(`/api/farm/plantings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setPlantingError(data.error ?? "Delete failed");
      return;
    }
    setPlantings((prev) => prev.filter((pl) => pl.id !== id));
    if (editingPlantingId === id) resetPlantingForm();
    router.refresh();
  }

  async function submitPlanting(e: React.FormEvent) {
    e.preventDefault();
    if (!plantingPlotId || !crop.trim()) {
      setPlantingError("Plot and crop are required.");
      return;
    }
    setPlantingSaving(true);
    setPlantingError(null);
    try {
      const isEdit = Boolean(editingPlantingId);
      const res = await fetch(
        isEdit ? `/api/farm/plantings/${editingPlantingId}` : "/api/farm/plantings",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  status: plantingStatus,
                  plantedOn: plantedOn || null,
                  expectedHarvestOn: expectedHarvestOn || null,
                  targetYieldKg: targetYieldKg ? Number(targetYieldKg) : null,
                  notes: plantingNotes.trim() || null,
                }
              : {
                  plotId: plantingPlotId,
                  crop: crop.trim(),
                  season: season.trim() || undefined,
                  plantedOn: plantedOn || undefined,
                  expectedHarvestOn: expectedHarvestOn || undefined,
                  targetYieldKg: targetYieldKg ? Number(targetYieldKg) : undefined,
                  status: plantingStatus,
                  notes: plantingNotes.trim() || undefined,
                },
          ),
        },
      );
      const data = (await res.json()) as {
        planting?: FarmCropPlanting;
        error?: string;
      };
      if (!res.ok || !data.planting) {
        setPlantingError(data.error ?? "Failed to save planting");
        return;
      }
      const plotCode = plots.find((p) => p.id === data.planting!.plot_id)?.code;
      setPlantings((prev) =>
        isEdit
          ? prev.map((pl) =>
              pl.id === data.planting!.id
                ? { ...data.planting!, plot_code: plotCode }
                : pl,
            )
          : [{ ...data.planting!, plot_code: plotCode }, ...prev],
      );
      resetPlantingForm();
      router.refresh();
    } catch {
      setPlantingError("Network error.");
    } finally {
      setPlantingSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-electric-blue">Plots</h2>

        <form
          onSubmit={(e) => void submitPlot(e)}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingPlotId ? "Edit plot" : "Add plot"}
          </h3>
          {plotError ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {plotError}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required={!editingPlotId}
                disabled={Boolean(editingPlotId)}
                placeholder="e.g. A"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink disabled:bg-app-bg"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Acreage</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={acreage}
                onChange={(e) => setAcreage(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlotStatus)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {PLOT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-semibold text-ink">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={plotSaving}
            className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {plotSaving ? "Saving…" : editingPlotId ? "Update plot" : "Add plot"}
          </button>
          {editingPlotId ? (
            <button
              type="button"
              onClick={resetPlotForm}
              className="ml-2 mt-4 rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted"
            >
              Cancel
            </button>
          ) : null}
        </form>

        <ul className="divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {plots.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No plots yet.
            </li>
          ) : (
            plots.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {p.code}
                    {p.name ? ` · ${p.name}` : ""}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {p.acreage.toFixed(2)} acres
                    {p.location ? ` · ${p.location}` : ""}
                  </p>
                  {p.notes ? (
                    <p className="mt-1 text-xs text-ink-faint">{p.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-ink-muted">Status</span>
                    <select
                      value={p.status}
                      onChange={(e) =>
                        void changePlotStatus(p.id, e.target.value as PlotStatus)
                      }
                      className={`rounded-[var(--radius-sm)] border border-card-border px-2 py-1 text-xs font-semibold ${plotStatusClass(p.status)}`}
                    >
                      {PLOT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FarmCrudActions
                    onEdit={() => startEditPlot(p)}
                    onDelete={() => void deletePlotRow(p.id)}
                  />
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-electric-blue">
          Crop plantings
        </h2>

        <form
          onSubmit={(e) => void submitPlanting(e)}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingPlantingId ? "Edit planting" : "Add crop planting"}
          </h3>
          {plantingError ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {plantingError}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Plot</span>
              <select
                value={plantingPlotId}
                onChange={(e) => setPlantingPlotId(e.target.value)}
                required
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {plots.length === 0 ? (
                  <option value="">No plots</option>
                ) : (
                  plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                      {p.name ? ` · ${p.name}` : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Crop</span>
              <input
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                required={!editingPlantingId}
                disabled={Boolean(editingPlantingId)}
                placeholder="e.g. Maize"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink disabled:bg-app-bg"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Season</span>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="e.g. 2026 long rains"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Status</span>
              <select
                value={plantingStatus}
                onChange={(e) =>
                  setPlantingStatus(e.target.value as PlantingStatus)
                }
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {PLANTING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Planted on</span>
              <input
                type="date"
                value={plantedOn}
                onChange={(e) => setPlantedOn(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">
                Expected harvest on
              </span>
              <input
                type="date"
                value={expectedHarvestOn}
                onChange={(e) => setExpectedHarvestOn(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">
                Target yield (kg)
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={targetYieldKg}
                onChange={(e) => setTargetYieldKg(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-semibold text-ink">Notes</span>
              <textarea
                value={plantingNotes}
                onChange={(e) => setPlantingNotes(e.target.value)}
                rows={2}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={plantingSaving || plots.length === 0}
            className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {plantingSaving ? "Saving…" : editingPlantingId ? "Update planting" : "Add planting"}
          </button>
          {editingPlantingId ? (
            <button
              type="button"
              onClick={resetPlantingForm}
              className="ml-2 mt-4 rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted"
            >
              Cancel
            </button>
          ) : null}
        </form>

        <ul className="divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {plantings.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No crop plantings yet.
            </li>
          ) : (
            plantings.map((pl) => (
              <li key={pl.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {pl.plot_code ?? pl.plot_id} · {pl.crop}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {pl.season ?? "No season"} · {pl.status}
                    </p>
                    {pl.notes ? (
                      <p className="mt-1 text-xs text-ink-faint">
                        {pl.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right text-xs text-ink-faint">
                    <div>
                      <p>Planted: {pl.planted_on ?? "—"}</p>
                      <p>Harvest: {pl.expected_harvest_on ?? "—"}</p>
                      {pl.target_yield_kg != null ? (
                        <p>Target: {pl.target_yield_kg} kg</p>
                      ) : null}
                    </div>
                    <FarmCrudActions
                      onEdit={() => startEditPlanting(pl)}
                      onDelete={() => void deletePlantingRow(pl.id)}
                    />
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
