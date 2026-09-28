"use client";

import { useEffect, useState } from "react";
import type { KitchenCalcMethod, KitchenIngredient, KitchenIngredientCategory } from "@/lib/db/kitchen";

const CATEGORY_OPTIONS: KitchenIngredientCategory[] = ["grain", "vegetable", "meat", "other"];
const CALC_METHOD_OPTIONS: KitchenCalcMethod[] = ["headcount_ratio", "flat_weekly"];
const CALC_METHOD_LABELS: Record<KitchenCalcMethod, string> = {
  headcount_ratio: "Headcount ratio (person-days ÷ people/kg)",
  flat_weekly: "Flat weekly (kg/week × weeks)",
};

function emptyForm() {
  return {
    name: "",
    unit: "kg",
    category: "grain" as KitchenIngredientCategory,
    calcMethod: "headcount_ratio" as KitchenCalcMethod,
    peoplePerKg: "",
    kgPerWeek: "",
    defaultUnitPrice: "",
  };
}

export function KitchenIngredientsPanel() {
  const [ingredients, setIngredients] = useState<KitchenIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/kitchen/ingredients");
        const data = (await res.json()) as { ingredients?: KitchenIngredient[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load ingredients");
          return;
        }
        setIngredients(data.ingredients ?? []);
      } catch {
        setError("Network error loading ingredients");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function addIngredient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          unit: form.unit.trim() || "kg",
          category: form.category,
          calcMethod: form.calcMethod,
          peoplePerKg: form.peoplePerKg ? Number(form.peoplePerKg) : null,
          kgPerWeek: form.kgPerWeek ? Number(form.kgPerWeek) : null,
          defaultUnitPrice: form.defaultUnitPrice ? Number(form.defaultUnitPrice) : 0,
        }),
      });
      const data = (await res.json()) as { ingredient?: KitchenIngredient; error?: string };
      if (!res.ok || !data.ingredient) {
        setError(data.error ?? "Failed to add ingredient");
        return;
      }
      setIngredients((prev) => [...prev, data.ingredient!]);
      setForm(emptyForm());
    } catch {
      setError("Network error adding ingredient");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(ingredient: KitchenIngredient) {
    setEditingId(ingredient.id);
    setEditForm({
      name: ingredient.name,
      unit: ingredient.unit,
      category: ingredient.category,
      calcMethod: ingredient.calc_method,
      peoplePerKg: ingredient.people_per_kg?.toString() ?? "",
      kgPerWeek: ingredient.kg_per_week?.toString() ?? "",
      defaultUnitPrice: ingredient.default_unit_price.toString(),
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/ingredients/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        unit: editForm.unit.trim() || "kg",
        category: editForm.category,
        calcMethod: editForm.calcMethod,
        peoplePerKg: editForm.peoplePerKg ? Number(editForm.peoplePerKg) : null,
        kgPerWeek: editForm.kgPerWeek ? Number(editForm.kgPerWeek) : null,
        defaultUnitPrice: editForm.defaultUnitPrice ? Number(editForm.defaultUnitPrice) : 0,
      }),
    });
    const data = (await res.json()) as { ingredient?: KitchenIngredient; error?: string };
    if (res.ok && data.ingredient) {
      setIngredients((prev) => prev.map((i) => (i.id === editingId ? data.ingredient! : i)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update ingredient");
    }
  }

  async function toggleActive(ingredient: KitchenIngredient) {
    const res = await fetch(`/api/kitchen/ingredients/${ingredient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ingredient.active }),
    });
    const data = (await res.json()) as { ingredient?: KitchenIngredient; error?: string };
    if (res.ok && data.ingredient) {
      setIngredients((prev) => prev.map((i) => (i.id === ingredient.id ? data.ingredient! : i)));
    } else {
      setError(data.error ?? "Failed to update ingredient");
    }
  }

  return (
    <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        H · Ingredients
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Ingredient catalog</h2>
      <p className="mt-1 text-sm text-ink-muted">
        The 21 seeded items, plus anything new. People/kg and kg/week here
        are the global defaults — per-campus overrides live in the ratio table below.
      </p>

      <form
        onSubmit={(e) => void addIngredient(e)}
        className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-7"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Unit</span>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Category</span>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value as KitchenIngredientCategory }))
            }
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Calc method</span>
          <select
            value={form.calcMethod}
            onChange={(e) =>
              setForm((f) => ({ ...f, calcMethod: e.target.value as KitchenCalcMethod }))
            }
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          >
            {CALC_METHOD_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CALC_METHOD_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">People/kg</span>
          <input
            type="number"
            step="0.1"
            value={form.peoplePerKg}
            onChange={(e) => setForm((f) => ({ ...f, peoplePerKg: e.target.value }))}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Kg/week</span>
          <input
            type="number"
            step="0.1"
            value={form.kgPerWeek}
            onChange={(e) => setForm((f) => ({ ...f, kgPerWeek: e.target.value }))}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Price (TZS)</span>
          <input
            type="number"
            step="1"
            value={form.defaultUnitPrice}
            onChange={(e) => setForm((f) => ({ ...f, defaultUnitPrice: e.target.value }))}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <div className="sm:col-span-3 lg:col-span-7">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add ingredient"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : ingredients.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-4 text-center text-sm text-ink-muted">
          No ingredients yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <ul className="min-w-[720px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
            {ingredients.map((ingredient) =>
              editingId === ingredient.id ? (
                <li
                  key={ingredient.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-32 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="text"
                    value={editForm.unit}
                    onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-16 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <select
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        category: e.target.value as KitchenIngredientCategory,
                      }))
                    }
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.calcMethod}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, calcMethod: e.target.value as KitchenCalcMethod }))
                    }
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  >
                    {CALC_METHOD_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="People/kg"
                    value={editForm.peoplePerKg}
                    onChange={(e) => setEditForm((f) => ({ ...f, peoplePerKg: e.target.value }))}
                    className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Kg/week"
                    value={editForm.kgPerWeek}
                    onChange={(e) => setEditForm((f) => ({ ...f, kgPerWeek: e.target.value }))}
                    className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="number"
                    step="1"
                    placeholder="Price"
                    value={editForm.defaultUnitPrice}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, defaultUnitPrice: e.target.value }))
                    }
                    className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
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
                  key={ingredient.id}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className={`font-semibold ${ingredient.active ? "text-ink" : "text-ink-faint"}`}>
                    {ingredient.name}
                    {!ingredient.active ? " (inactive)" : ""}
                  </span>
                  <span className="text-ink-muted">{ingredient.category}</span>
                  <span className="text-ink-muted">
                    {ingredient.calc_method === "flat_weekly"
                      ? `${ingredient.kg_per_week ?? "—"} kg/wk`
                      : `${ingredient.people_per_kg ?? "—"} ppl/kg`}
                  </span>
                  <span className="text-right text-ink-muted">
                    TZS {ingredient.default_unit_price.toLocaleString()}
                  </span>
                  <span className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(ingredient)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(ingredient)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      {ingredient.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
