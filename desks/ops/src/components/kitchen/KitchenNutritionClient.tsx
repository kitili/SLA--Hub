"use client";

import { useEffect, useState } from "react";
import type {
  KitchenAllergen,
  KitchenIngredient,
  KitchenIngredientNutrition,
} from "@/lib/db/kitchen";

type Props = { ingredients: KitchenIngredient[] };

type NutritionField = "caloriesPer100g" | "proteinG" | "carbsG" | "fatG" | "fiberG";

const FIELD_LABELS: Record<NutritionField, string> = {
  caloriesPer100g: "Calories/100g",
  proteinG: "Protein (g)",
  carbsG: "Carbs (g)",
  fatG: "Fat (g)",
  fiberG: "Fiber (g)",
};

const FIELD_TO_COLUMN: Record<NutritionField, keyof KitchenIngredientNutrition> = {
  caloriesPer100g: "calories_per_100g",
  proteinG: "protein_g",
  carbsG: "carbs_g",
  fatG: "fat_g",
  fiberG: "fiber_g",
};

export function KitchenNutritionClient({ ingredients }: Props) {
  const [allergens, setAllergens] = useState<KitchenAllergen[]>([]);
  const [byIngredientAllergens, setByIngredientAllergens] = useState<Record<string, string[]>>({});
  const [byIngredientNutrition, setByIngredientNutrition] = useState<
    Record<string, KitchenIngredientNutrition>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [allergensRes, ingAllergensRes, nutritionRes] = await Promise.all([
          fetch("/api/kitchen/allergens"),
          fetch("/api/kitchen/ingredient-allergens"),
          fetch("/api/kitchen/ingredient-nutrition"),
        ]);
        const allergensData = (await allergensRes.json()) as { allergens?: KitchenAllergen[]; error?: string };
        const ingAllergensData = (await ingAllergensRes.json()) as {
          byIngredient?: Record<string, string[]>;
          error?: string;
        };
        const nutritionData = (await nutritionRes.json()) as {
          byIngredient?: Record<string, KitchenIngredientNutrition>;
          error?: string;
        };
        if (!allergensRes.ok) {
          setError(allergensData.error ?? "Failed to load allergens");
          return;
        }
        setAllergens(allergensData.allergens ?? []);
        setByIngredientAllergens(ingAllergensData.byIngredient ?? {});
        setByIngredientNutrition(nutritionData.byIngredient ?? {});
      } catch {
        setError("Network error loading nutrition data");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function saveNutritionField(ingredientId: string, field: NutritionField, value: string) {
    setSavingId(ingredientId);
    setError(null);
    try {
      const existing = byIngredientNutrition[ingredientId];
      const payload = {
        ingredientId,
        caloriesPer100g: existing?.calories_per_100g ?? undefined,
        proteinG: existing?.protein_g ?? undefined,
        carbsG: existing?.carbs_g ?? undefined,
        fatG: existing?.fat_g ?? undefined,
        fiberG: existing?.fiber_g ?? undefined,
        [field]: value === "" ? undefined : Number(value),
      };
      const res = await fetch("/api/kitchen/ingredient-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { nutrition?: KitchenIngredientNutrition; error?: string };
      if (!res.ok || !data.nutrition) {
        setError(data.error ?? "Failed to save nutrition data");
        return;
      }
      setByIngredientNutrition((prev) => ({ ...prev, [ingredientId]: data.nutrition! }));
    } catch {
      setError("Network error saving nutrition data");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleAllergen(ingredientId: string, allergenId: string, checked: boolean) {
    const current = byIngredientAllergens[ingredientId] ?? [];
    const next = checked ? [...current, allergenId] : current.filter((id) => id !== allergenId);
    setByIngredientAllergens((prev) => ({ ...prev, [ingredientId]: next }));
    const res = await fetch("/api/kitchen/ingredient-allergens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredientId, allergenIds: next }),
    });
    if (!res.ok) {
      setByIngredientAllergens((prev) => ({ ...prev, [ingredientId]: current }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Nutrition &amp; allergens
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Ingredient facts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Global per ingredient, not per campus — nobody has verified real nutrition values yet,
          so every field starts blank. Fill in what you know; leave the rest blank.
        </p>

        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-muted">
                  <th className="pb-2">Ingredient</th>
                  {(Object.keys(FIELD_LABELS) as NutritionField[]).map((f) => (
                    <th key={f} className="pb-2">
                      {FIELD_LABELS[f]}
                    </th>
                  ))}
                  <th className="pb-2">Allergens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {ingredients.map((ing) => {
                  const nutrition = byIngredientNutrition[ing.id];
                  const tagged = byIngredientAllergens[ing.id] ?? [];
                  return (
                    <tr key={ing.id}>
                      <td className="py-2 font-semibold text-ink">{ing.name}</td>
                      {(Object.keys(FIELD_LABELS) as NutritionField[]).map((f) => (
                        <td key={f} className="py-2">
                          <input
                            type="number"
                            step="0.1"
                            defaultValue={nutrition?.[FIELD_TO_COLUMN[f]] ?? ""}
                            disabled={savingId === ing.id}
                            onBlur={(e) => void saveNutritionField(ing.id, f, e.target.value)}
                            className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                          />
                        </td>
                      ))}
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          {allergens.map((a) => (
                            <label key={a.id} className="flex items-center gap-1 text-xs text-ink-muted">
                              <input
                                type="checkbox"
                                checked={tagged.includes(a.id)}
                                onChange={(e) => void toggleAllergen(ing.id, a.id, e.target.checked)}
                              />
                              {a.name}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
