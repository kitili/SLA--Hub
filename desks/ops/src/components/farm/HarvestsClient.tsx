"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type {
  FarmCropPlanting,
  FarmHarvest,
  FarmPlot,
  HarvestDestination,
} from "@/lib/db/farm";

const DESTINATIONS: HarvestDestination[] = [
  "kitchen",
  "sold",
  "seed_stock",
  "waste",
  "other",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function destinationClass(destination: HarvestDestination): string {
  if (destination === "kitchen") return "text-success";
  if (destination === "waste") return "text-danger";
  return "text-ink-muted";
}

type Props = {
  plots: FarmPlot[];
  plantings: FarmCropPlanting[];
  initialHarvests: FarmHarvest[];
};

export function HarvestsClient({ plots, plantings, initialHarvests }: Props) {
  const router = useRouter();
  const [harvests, setHarvests] = useState(initialHarvests);
  const [plotId, setPlotId] = useState(plots[0]?.id ?? "");
  const [plantingId, setPlantingId] = useState("");
  const [harvestedOn, setHarvestedOn] = useState(todayIso());
  const [quantityKg, setQuantityKg] = useState("");
  const [valueAmount, setValueAmount] = useState("");
  const [destination, setDestination] = useState<HarvestDestination>("kitchen");
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterPlotId, setFilterPlotId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const plotCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plots) map.set(p.id, p.code);
    return map;
  }, [plots]);

  const plantingOptions = useMemo(
    () =>
      plotId
        ? plantings.filter((p) => p.plot_id === plotId)
        : plantings,
    [plantings, plotId],
  );

  function resetForm() {
    setEditingId(null);
    setPlotId(plots[0]?.id ?? "");
    setPlantingId("");
    setHarvestedOn(todayIso());
    setQuantityKg("");
    setValueAmount("");
    setDestination("kitchen");
    setPhotoUrl("");
    setNotes("");
  }

  function startEdit(h: FarmHarvest) {
    setEditingId(h.id);
    setPlotId(h.plot_id);
    setPlantingId(h.planting_id ?? "");
    setHarvestedOn(h.harvested_on);
    setQuantityKg(String(h.quantity_kg));
    setValueAmount(h.value_amount != null ? String(h.value_amount) : "");
    setDestination(h.destination);
    setPhotoUrl(h.photo_url ?? "");
    setNotes(h.notes ?? "");
    setError(null);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this harvest record?")) return;
    const res = await fetch(`/api/farm/harvests/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setHarvests((prev) => prev.filter((h) => h.id !== id));
    if (editingId === id) resetForm();
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantityKg);
    if (!plotId || !quantityKg || !(qty > 0)) {
      setError("Plot and a positive quantity (kg) are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/farm/harvests/${editingId}` : "/api/farm/harvests",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plotId,
            plantingId: plantingId || null,
            harvestedOn: harvestedOn || undefined,
            quantityKg: qty,
            valueAmount: valueAmount ? Number(valueAmount) : null,
            destination,
            photoUrl: photoUrl.trim() || null,
            notes: notes.trim() || null,
          }),
        },
      );
      const data = (await res.json()) as {
        harvest?: FarmHarvest;
        error?: string;
      };
      if (!res.ok || !data.harvest) {
        setError(data.error ?? "Failed to save harvest");
        return;
      }
      setHarvests((prev) =>
        isEdit
          ? prev.map((h) => (h.id === data.harvest!.id ? data.harvest! : h))
          : [data.harvest!, ...prev],
      );
      resetForm();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const visible = filterPlotId
    ? harvests.filter((h) => h.plot_id === filterPlotId)
    : harvests;

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {editingId ? "Edit harvest" : "Log harvest"}
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Plot</span>
            <select
              value={plotId}
              onChange={(e) => {
                setPlotId(e.target.value);
                setPlantingId("");
              }}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {plots.length === 0 ? (
                <option value="">No plots</option>
              ) : (
                plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.name ? `· ${p.name}` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Planting (optional)</span>
            <select
              value={plantingId}
              onChange={(e) => setPlantingId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">None</option>
              {plantingOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.plot_code ?? plotCodeById.get(p.plot_id) ?? p.plot_id)} ·{" "}
                  {p.crop}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Harvested on</span>
            <input
              type="date"
              value={harvestedOn}
              onChange={(e) => setHarvestedOn(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quantity (kg)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">
              Value (TZS, market or internal-use estimate)
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={valueAmount}
              onChange={(e) => setValueAmount(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Destination</span>
            <select
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value as HarvestDestination)
              }
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Photo URL</span>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste photo URL (upload UI coming later)"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
            <span className="text-xs text-ink-faint">
              Photo upload isn&apos;t wired up yet — paste a URL if you have
              one hosted elsewhere.
            </span>
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
          disabled={saving || plots.length === 0}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : editingId ? "Update harvest" : "Save harvest"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={resetForm}
            className="ml-2 mt-4 rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted"
          >
            Cancel
          </button>
        ) : null}
      </form>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-electric-blue">Harvests</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Filter by plot</span>
            <select
              value={filterPlotId}
              onChange={(e) => setFilterPlotId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">All plots</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {visible.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No harvests logged yet.
            </li>
          ) : (
            visible.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {plotCodeById.get(h.plot_id) ?? h.plot_id}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {h.harvested_on} · {h.quantity_kg.toLocaleString()} kg ·{" "}
                      <span className={`font-semibold ${destinationClass(h.destination)}`}>
                        {h.destination}
                      </span>
                    </p>
                    {h.notes ? (
                      <p className="mt-1 text-xs text-ink-faint">{h.notes}</p>
                    ) : null}
                    {h.photo_url ? (
                      <a
                        href={h.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-electric-blue underline"
                      >
                        View photo
                      </a>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-electric-blue">
                      {h.value_amount != null
                        ? `${h.value_amount.toLocaleString()} ${h.currency}`
                        : "—"}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {h.created_at.slice(0, 10)}
                    </p>
                    <FarmCrudActions
                      className="mt-2 justify-end"
                      onEdit={() => startEdit(h)}
                      onDelete={() => void deleteRow(h.id)}
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
