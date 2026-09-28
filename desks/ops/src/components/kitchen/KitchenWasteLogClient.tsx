"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type { KitchenIngredient, KitchenWasteLog, KitchenWasteReason } from "@/lib/db/kitchen";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = { schools: School[]; ingredients: KitchenIngredient[] };

const REASON_LABELS: Record<KitchenWasteReason, string> = {
  leftover: "Leftover",
  spoiled: "Spoiled",
  prep_waste: "Prep waste",
  other: "Other",
};

function defaultSchoolId(schools: School[]) {
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ?? schools[0];
  return prefer?.id ?? "";
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function KitchenWasteLogClient({ schools, ingredients }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [logs, setLogs] = useState<KitchenWasteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ingredientId, setIngredientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [reason, setReason] = useState<KitchenWasteReason>("leftover");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editReason, setEditReason] = useState<KitchenWasteReason>("leftover");
  const [editNotes, setEditNotes] = useState("");

  // Computed once per mount, not on every render -- Date.now()/new Date() are
  // impure to call directly in the render body.
  const { today, thirtyDaysAgo } = useMemo(() => {
    const now = new Date();
    return {
      today: isoDate(now),
      thirtyDaysAgo: isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kitchen/waste-logs?schoolId=${encodeURIComponent(schoolId)}&start=${thirtyDaysAgo}&end=${today}`,
        );
        const data = (await res.json()) as { logs?: KitchenWasteLog[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load waste logs");
          return;
        }
        setLogs(data.logs ?? []);
      } catch {
        setError("Network error loading waste logs");
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !quantity) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/waste-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          itemName: itemName.trim(),
          ingredientId: ingredientId || undefined,
          quantity: Number(quantity) || 0,
          unit,
          reason,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { log?: KitchenWasteLog; error?: string };
      if (!res.ok || !data.log) {
        setError(data.error ?? "Failed to log waste");
        return;
      }
      setLogs((prev) => [data.log!, ...prev]);
      setItemName("");
      setQuantity("");
      setNotes("");
    } catch {
      setError("Network error logging waste");
    } finally {
      setSaving(false);
    }
  }

  async function removeLog(id: string) {
    const prev = logs;
    setLogs((l) => l.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/waste-logs/${id}`, { method: "DELETE" });
    if (!res.ok) setLogs(prev);
  }

  function startEdit(l: KitchenWasteLog) {
    setEditingId(l.id);
    setEditItemName(l.item_name);
    setEditQuantity(String(l.quantity));
    setEditUnit(l.unit);
    setEditReason(l.reason);
    setEditNotes(l.notes ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/waste-logs/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemName: editItemName.trim(),
        quantity: Number(editQuantity) || 0,
        unit: editUnit,
        reason: editReason,
        notes: editNotes.trim() || null,
      }),
    });
    const data = (await res.json()) as { log?: KitchenWasteLog; error?: string };
    if (res.ok && data.log) {
      setLogs((prev) => prev.map((l) => (l.id === editingId ? data.log! : l)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update waste log");
    }
  }

  const campusName = schools.find((s) => s.id === schoolId)?.name ?? "Campus";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            {campusName}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {loading ? "Loading…" : `${logs.length} entries in the last 30 days`}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Campus
          </span>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">Waste</p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Log waste</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Leftover, spoiled, or prep waste — helps check whether Procurement&apos;s ordering
          ratios actually match what gets eaten.
        </p>

        <form onSubmit={(e) => void addLog(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-semibold text-ink">Item</span>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Rice"
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Link to ingredient</span>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">Not linked</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quantity</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Unit</span>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Reason</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as KitchenWasteReason)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {(Object.keys(REASON_LABELS) as KitchenWasteReason[]).map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="lg:col-span-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log waste"}
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[560px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {logs.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No waste logged in the last 30 days.
            </li>
          ) : (
            logs.map((l) =>
              editingId === l.id ? (
                <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="text"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-16 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value as KitchenWasteReason)}
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  >
                    {(Object.keys(REASON_LABELS) as KitchenWasteReason[]).map((r) => (
                      <option key={r} value={r}>
                        {REASON_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs font-semibold text-ink-muted hover:underline"
                  >
                    Cancel
                  </button>
                </li>
              ) : (
                <li
                  key={l.id}
                  className="grid grid-cols-[1.6fr_1.4fr_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">{l.item_name}</span>
                  <span className="text-ink-muted">
                    {l.quantity} {l.unit} · {REASON_LABELS[l.reason]}
                  </span>
                  <span className="text-right text-xs text-ink-faint">{l.logged_on}</span>
                  <span className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(l)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeLog(l.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ),
            )
          )}
        </ul>
        </div>
      </section>
    </div>
  );
}
