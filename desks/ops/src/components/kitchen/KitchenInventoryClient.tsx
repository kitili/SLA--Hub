"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type { KitchenIngredient, KitchenInventoryCount } from "@/lib/db/kitchen";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = { schools: School[]; ingredients: KitchenIngredient[] };

function defaultSchoolId(schools: School[]) {
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ?? schools[0];
  return prefer?.id ?? "";
}

export function KitchenInventoryClient({ schools, ingredients }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [counts, setCounts] = useState<KitchenInventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const [countedOn, setCountedOn] = useState("");
  const [quantityOnHand, setQuantityOnHand] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { today, ninetyDaysAgo } = useMemo(() => {
    const now = new Date();
    return {
      today: now.toISOString().slice(0, 10),
      ninetyDaysAgo: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kitchen/inventory?schoolId=${encodeURIComponent(schoolId)}&start=${ninetyDaysAgo}&end=${today}`,
        );
        const data = (await res.json()) as { counts?: KitchenInventoryCount[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load inventory counts");
          return;
        }
        setCounts(data.counts ?? []);
      } catch {
        setError("Network error loading inventory counts");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId, today, ninetyDaysAgo]);

  const ingredientName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  async function addCount(e: React.FormEvent) {
    e.preventDefault();
    if (!ingredientId || !countedOn || !quantityOnHand) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          ingredientId,
          countedOn,
          quantityOnHand: Number(quantityOnHand) || 0,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { count?: KitchenInventoryCount; error?: string };
      if (!res.ok || !data.count) {
        setError(data.error ?? "Failed to save inventory count");
        return;
      }
      setCounts((prev) => [data.count!, ...prev.filter((c) => c.id !== data.count!.id)]);
      setCountedOn("");
      setQuantityOnHand("");
      setNotes("");
    } catch {
      setError("Network error saving inventory count");
    } finally {
      setSaving(false);
    }
  }

  async function removeCount(id: string) {
    const prev = counts;
    setCounts((c) => c.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/inventory/${id}`, { method: "DELETE" });
    if (!res.ok) setCounts(prev);
  }

  function editCount(c: KitchenInventoryCount) {
    setIngredientId(c.ingredient_id);
    setCountedOn(c.counted_on);
    setQuantityOnHand(String(c.quantity_on_hand));
    setNotes(c.notes ?? "");
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
            Stock on hand — never tracked here before, starts empty until counts are logged.
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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Inventory
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Log a stock count</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Quantity on hand for one ingredient at this campus, on a given date — a running log,
          not a single mutable current-stock number.
        </p>

        <form onSubmit={(e) => void addCount(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-semibold text-ink">Ingredient</span>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Counted on</span>
            <input
              type="date"
              value={countedOn}
              onChange={(e) => setCountedOn(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quantity on hand</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={quantityOnHand}
              onChange={(e) => setQuantityOnHand(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <div className="lg:col-span-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log count"}
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <ul className="min-w-[560px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
            {loading ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">Loading…</li>
            ) : counts.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">
                No stock counts logged in the last 90 days.
              </li>
            ) : (
              counts.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">{ingredientName(c.ingredient_id)}</span>
                  <span className="text-ink-muted">{c.counted_on}</span>
                  <span className="text-right text-ink-muted">{c.quantity_on_hand}</span>
                  <span className="text-ink-faint">{c.notes ?? ""}</span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => editCount(c)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCount(c.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
