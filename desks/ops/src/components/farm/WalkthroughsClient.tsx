"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type { FarmPlot, FarmWalkthrough } from "@/lib/db/farm";

const CHECKLIST_ITEMS = [
  "fencing_condition",
  "irrigation_working",
  "weeding_up_to_date",
  "pest_disease_pressure",
  "soil_moisture",
  "staff_presence",
  "tool_storage",
] as const;

const CHECKLIST_LABELS: Record<(typeof CHECKLIST_ITEMS)[number], string> = {
  fencing_condition: "Fencing condition",
  irrigation_working: "Irrigation working",
  weeding_up_to_date: "Weeding up to date",
  pest_disease_pressure: "Pest / disease pressure",
  soil_moisture: "Soil moisture",
  staff_presence: "Staff presence",
  tool_storage: "Tool storage",
};

const SCORES = [1, 2, 3, 4, 5];

type PlotOption = Pick<FarmPlot, "id" | "code" | "name">;

type Props = {
  plots: PlotOption[];
  initialWalkthroughs: FarmWalkthrough[];
};

function scoreBadgeClass(score: number | null): string {
  if (score == null) return "bg-card-border text-ink-muted";
  if (score >= 4) return "bg-success-15 text-success";
  if (score >= 2.5) return "bg-gold-15 text-ink";
  return "bg-danger-15 text-danger";
}

export function WalkthroughsClient({ plots, initialWalkthroughs }: Props) {
  const router = useRouter();
  const [walkthroughs, setWalkthroughs] = useState(initialWalkthroughs);
  const [weekOf, setWeekOf] = useState("");
  const [plotId, setPlotId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item, 3])) as Record<
        string,
        number
      >,
  );
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  function plotLabel(id: string | null): string {
    if (!id) return "Farm-wide";
    const plot = plots.find((p) => p.id === id);
    return plot ? plot.code : "Farm-wide";
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetForm() {
    setEditingId(null);
    setWeekOf("");
    setPlotId("");
    setScores(
      Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item, 3])) as Record<
        string,
        number
      >,
    );
    setNotes("");
    setPhotoUrl("");
  }

  function startEdit(w: FarmWalkthrough) {
    setEditingId(w.id);
    setWeekOf(w.week_of);
    setPlotId(w.plot_id ?? "");
    const nextScores = Object.fromEntries(
      CHECKLIST_ITEMS.map((item) => [
        item,
        typeof w.checklist[item] === "number" ? (w.checklist[item] as number) : 3,
      ]),
    ) as Record<string, number>;
    setScores(nextScores);
    setNotes(w.notes ?? "");
    setPhotoUrl(w.photo_url ?? "");
    setError(null);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this walkthrough?")) return;
    const res = await fetch(`/api/farm/walkthroughs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setWalkthroughs((prev) => prev.filter((w) => w.id !== id));
    if (editingId === id) resetForm();
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!weekOf) {
      setError("Week of is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const values = CHECKLIST_ITEMS.map((item) => scores[item]);
      const overallScore =
        Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 10,
        ) / 10;

      const res = await fetch(
        editingId ? `/api/farm/walkthroughs/${editingId}` : "/api/farm/walkthroughs",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekOf,
            plotId: plotId || null,
            checklist: scores,
            overallScore,
            notes: notes.trim() || null,
            photoUrl: photoUrl.trim() || null,
          }),
        },
      );
      const data = (await res.json()) as {
        walkthrough?: FarmWalkthrough;
        error?: string;
      };
      if (!res.ok || !data.walkthrough) {
        setError(data.error ?? "Failed to save walkthrough");
        return;
      }
      setWalkthroughs((prev) =>
        editingId
          ? prev.map((w) => (w.id === data.walkthrough!.id ? data.walkthrough! : w))
          : [data.walkthrough!, ...prev],
      );
      resetForm();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {editingId ? "Edit walkthrough" : "Log weekly walkthrough"}
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Week of (Monday)</span>
            <input
              type="date"
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Plot</span>
            <select
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">Farm-wide</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                  {p.name ? ` — ${p.name}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => (
            <label key={item} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">
                {CHECKLIST_LABELS[item]}
              </span>
              <select
                value={scores[item]}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [item]: Number(e.target.value),
                  }))
                }
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                {SCORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
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
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : editingId ? "Update walkthrough" : "Save walkthrough"}
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
        <h2 className="text-lg font-bold text-electric-blue">
          Past walkthroughs
        </h2>

        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {walkthroughs.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No walkthroughs logged yet.
            </li>
          ) : (
            walkthroughs.map((w) => {
              const isOpen = expanded.has(w.id);
              return (
                <li key={w.id} className="px-4 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(w.id)}
                    className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-semibold text-ink">
                        Week of {w.week_of}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {plotLabel(w.plot_id)}
                      </p>
                      {w.notes ? (
                        <p className="mt-1 text-xs text-ink-faint">
                          {w.notes}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(
                        w.overall_score,
                      )}`}
                    >
                      {w.overall_score != null ? w.overall_score.toFixed(1) : "—"}
                    </span>
                  </button>
                  <FarmCrudActions
                    className="mt-2"
                    onEdit={() => startEdit(w)}
                    onDelete={() => void deleteRow(w.id)}
                  />
                  {isOpen ? (
                    <div className="mt-3 grid gap-1 rounded-[var(--radius-sm)] bg-app-bg p-3 sm:grid-cols-2">
                      {CHECKLIST_ITEMS.map((item) => {
                        const value = w.checklist[item];
                        return (
                          <div
                            key={item}
                            className="flex items-center justify-between text-xs text-ink-muted"
                          >
                            <span>{CHECKLIST_LABELS[item]}</span>
                            <span className="font-semibold text-ink">
                              {typeof value === "number" ? value : "—"}
                            </span>
                          </div>
                        );
                      })}
                      {w.photo_url ? (
                        <a
                          href={w.photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 text-xs font-semibold text-electric-blue sm:col-span-2"
                        >
                          View photo
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
