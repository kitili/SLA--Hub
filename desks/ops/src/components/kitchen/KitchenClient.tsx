"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type {
  KitchenBudget,
  KitchenHeadcountLine,
  KitchenIngredient,
  KitchenIngredientCampusSetting,
  KitchenPurchase,
} from "@/lib/db/kitchen";
import { buildIngredientRequirements } from "@/lib/kitchen/ingredient-calc";
import { KitchenIngredientsPanel } from "@/components/kitchen/KitchenIngredientsPanel";
import { KitchenStaffRoster } from "@/components/kitchen/KitchenStaffRoster";
import { KitchenVendorsPanel } from "@/components/kitchen/KitchenVendorsPanel";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = {
  schools: School[];
  ingredients: KitchenIngredient[];
};

function currentMonthValue() {
  // Prefer May 2026 when browsing in 2026 — that month has the richest
  // imported purchase block; headcount exists Jan–Aug across campuses.
  const d = new Date();
  if (d.getFullYear() === 2026) return "2026-05";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatTzs(n: number) {
  return `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const HEADCOUNT_CATEGORY_PRESETS = [
  { value: "day_student", label: "Day student" },
  { value: "boarding_dinner_student", label: "Boarding student (dinner)" },
  { value: "day_staff", label: "Day staff" },
  { value: "boarding_dinner_staff", label: "Boarding staff (dinner)" },
  { value: "boarding_weekend_kids", label: "Boarding kids (weekend)" },
  { value: "boarding_weekend_staff", label: "Boarding staff (weekend)" },
  { value: "other", label: "Other / cross-campus (add a label)" },
];

/** Sheet imports use freeform labels; the form select uses slug values. */
const HEADCOUNT_CATEGORY_ALIASES: Record<string, string> = {
  "day student": "day_student",
  "day staff": "day_staff",
  "boarding students - dinner": "boarding_dinner_student",
  "boarding student - dinner": "boarding_dinner_student",
  "boarding staff - dinner": "boarding_dinner_staff",
  "boarding kids weekend": "boarding_weekend_kids",
  "boarding staff weekend": "boarding_weekend_staff",
};

type HeadcountLineForm = {
  category: string;
  label: string;
  headcount: string;
  daysInPeriod: string;
  pricePerPerson: string;
};

function emptyHeadcountLine(): HeadcountLineForm {
  return { category: "day_student", label: "", headcount: "", daysInPeriod: "", pricePerPerson: "" };
}

function normalizeHeadcountCategory(
  rawCategory: string,
  rawLabel: string | null | undefined,
): Pick<HeadcountLineForm, "category" | "label"> {
  const trimmed = rawCategory.trim();
  if (HEADCOUNT_CATEGORY_PRESETS.some((p) => p.value === trimmed)) {
    return {
      category: trimmed,
      label: trimmed === "other" ? (rawLabel ?? "").trim() : "",
    };
  }
  const aliasKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  const mapped = HEADCOUNT_CATEGORY_ALIASES[aliasKey];
  if (mapped) {
    return { category: mapped, label: "" };
  }
  // Holiday / one-off sheet rows keep their original wording as Other labels.
  return { category: "other", label: (rawLabel ?? trimmed).trim() };
}

const CATEGORY_LABELS: Record<string, string> = {
  grain: "Grains & staples",
  vegetable: "Vegetables & fruit",
  meat: "Meat",
  other: "Other",
};

function defaultSchoolId(schools: School[]) {
  // Usa River has the densest imported kitchen sheet data.
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ??
    schools[0];
  return prefer?.id ?? "";
}

export function KitchenClient({ schools, ingredients }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [month, setMonth] = useState(currentMonthValue());
  // Starts true, not false -- the very first render happens before the
  // load() effect below has run at all, so a false default let that first
  // paint show a real (but wrong, default-ratio) requirements total with no
  // loading indicator, for as long as it took the effect to fire.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [headcountLines, setHeadcountLines] = useState<HeadcountLineForm[]>([]);
  const [savingHeadcount, setSavingHeadcount] = useState(false);

  const [campusSettings, setCampusSettings] = useState<KitchenIngredientCampusSetting[]>([]);
  const [effectivePrices, setEffectivePrices] = useState<Record<string, number>>({});
  const [savingSettingId, setSavingSettingId] = useState<string | null>(null);

  const [budgetAmount, setBudgetAmount] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const [purchases, setPurchases] = useState<KitchenPurchase[]>([]);
  const [purchaseIngredientId, setPurchaseIngredientId] = useState(ingredients[0]?.id ?? "");
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editPurchaseQty, setEditPurchaseQty] = useState("");
  const [editPurchaseUnitPrice, setEditPurchaseUnitPrice] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");

  const monthDate = `${month}-01`;

  const load = useCallback(async () => {
    if (!schoolId || !month) return;
    setLoading(true);
    setError(null);
    try {
      const monthQs = `?schoolId=${encodeURIComponent(schoolId)}&month=${encodeURIComponent(monthDate)}`;
      const [headcountRes, budgetRes, purchasesRes, settingsRes, pricesRes] = await Promise.all([
        fetch(`/api/kitchen/headcount${monthQs}`),
        fetch(`/api/kitchen/budget${monthQs}`),
        fetch(`/api/kitchen/purchases${monthQs}`),
        fetch(`/api/kitchen/ingredient-settings?schoolId=${encodeURIComponent(schoolId)}`),
        fetch(
          `/api/kitchen/ingredient-prices?schoolId=${encodeURIComponent(schoolId)}&asOf=${encodeURIComponent(monthDate)}`,
        ),
      ]);
      const headcountData = (await headcountRes.json()) as { lines?: KitchenHeadcountLine[] };
      const budgetData = (await budgetRes.json()) as { budget: KitchenBudget | null };
      const purchasesData = (await purchasesRes.json()) as { purchases?: KitchenPurchase[] };
      const settingsData = (await settingsRes.json()) as { settings?: KitchenIngredientCampusSetting[] };
      const pricesData = (await pricesRes.json()) as { prices?: Record<string, number> };

      const lines = headcountData.lines ?? [];
      setHeadcountLines(
        lines.length > 0
          ? lines.map((l) => {
              const { category, label } = normalizeHeadcountCategory(l.category, l.label);
              return {
                category,
                label,
                headcount: String(l.headcount),
                daysInPeriod: String(l.days_in_period),
                pricePerPerson: String(l.price_per_person),
              };
            })
          : [emptyHeadcountLine()],
      );

      setBudgetAmount(budgetData.budget ? String(budgetData.budget.budget_amount) : "");
      setPurchases(purchasesData.purchases ?? []);
      setCampusSettings(settingsData.settings ?? []);
      setEffectivePrices(pricesData.prices ?? {});
    } catch {
      setError("Network error loading kitchen data");
    } finally {
      setLoading(false);
    }
  }, [schoolId, month, monthDate]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLine(index: number, patch: Partial<HeadcountLineForm>) {
    setHeadcountLines((lines) => lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setHeadcountLines((lines) => [...lines, emptyHeadcountLine()]);
  }

  function removeLine(index: number) {
    setHeadcountLines((lines) => lines.filter((_, i) => i !== index));
  }

  async function saveHeadcount() {
    setSavingHeadcount(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/headcount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          month: monthDate,
          lines: headcountLines
            .filter((l) => l.headcount.trim() !== "")
            .map((l) => ({
              category: l.category,
              label: l.category === "other" ? l.label.trim() || null : null,
              headcount: Number(l.headcount) || 0,
              daysInPeriod: Number(l.daysInPeriod) || 0,
              pricePerPerson: Number(l.pricePerPerson) || 0,
            })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save headcount");
      }
    } catch {
      setError("Network error saving headcount");
    } finally {
      setSavingHeadcount(false);
    }
  }

  async function saveIngredientSetting(
    ingredientId: string,
    patch: { peoplePerKg?: number | null; kgPerWeek?: number | null; weeksInMonth?: number | null },
  ) {
    setSavingSettingId(ingredientId);
    setError(null);
    try {
      const existing = campusSettings.find((s) => s.ingredient_id === ingredientId);
      const res = await fetch("/api/kitchen/ingredient-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          ingredientId,
          peoplePerKg: patch.peoplePerKg ?? existing?.people_per_kg ?? null,
          kgPerWeek: patch.kgPerWeek ?? existing?.kg_per_week ?? null,
          weeksInMonth: patch.weeksInMonth ?? existing?.weeks_in_month ?? null,
        }),
      });
      const data = (await res.json()) as { setting?: KitchenIngredientCampusSetting; error?: string };
      if (!res.ok || !data.setting) {
        setError(data.error ?? "Failed to save campus setting");
        return;
      }
      setCampusSettings((prev) => [
        ...prev.filter((s) => s.ingredient_id !== ingredientId),
        data.setting!,
      ]);
    } catch {
      setError("Network error saving campus setting");
    } finally {
      setSavingSettingId(null);
    }
  }

  async function recordPrice(ingredientId: string, unitPrice: number) {
    setSavingSettingId(ingredientId);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/ingredient-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId,
          schoolId,
          effectiveDate: monthDate,
          unitPrice,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to record price");
        return;
      }
      setEffectivePrices((prev) => ({ ...prev, [ingredientId]: unitPrice }));
    } catch {
      setError("Network error recording price");
    } finally {
      setSavingSettingId(null);
    }
  }

  async function saveBudget() {
    setSavingBudget(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          month: monthDate,
          budgetAmount: Number(budgetAmount) || 0,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save budget");
      }
    } catch {
      setError("Network error saving budget");
    } finally {
      setSavingBudget(false);
    }
  }

  async function addPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!purchaseIngredientId || !purchaseQty) {
      setError("Ingredient and quantity are required.");
      return;
    }
    setSavingPurchase(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          month: monthDate,
          ingredientId: purchaseIngredientId,
          quantity: Number(purchaseQty) || 0,
          unitPrice: Number(purchaseUnitPrice) || 0,
          purchasedOn: purchaseDate || undefined,
        }),
      });
      const data = (await res.json()) as { purchase?: KitchenPurchase; error?: string };
      if (!res.ok || !data.purchase) {
        setError(data.error ?? "Failed to record purchase");
        return;
      }
      setPurchases((prev) => [data.purchase!, ...prev]);
      setPurchaseQty("");
      setPurchaseUnitPrice("");
      setPurchaseDate("");
    } catch {
      setError("Network error recording purchase");
    } finally {
      setSavingPurchase(false);
    }
  }

  async function removePurchase(id: string) {
    const prev = purchases;
    setPurchases((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/purchases/${id}`, { method: "DELETE" });
    if (!res.ok) setPurchases(prev);
  }

  function startEditPurchase(p: KitchenPurchase) {
    setEditingPurchaseId(p.id);
    setEditPurchaseQty(String(p.quantity));
    setEditPurchaseUnitPrice(String(p.unit_price));
    setEditPurchaseDate(p.purchased_on ?? "");
  }

  async function saveEditPurchase() {
    if (!editingPurchaseId) return;
    const res = await fetch(`/api/kitchen/purchases/${editingPurchaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(editPurchaseQty) || 0,
        unitPrice: Number(editPurchaseUnitPrice) || 0,
        purchasedOn: editPurchaseDate || null,
      }),
    });
    const data = (await res.json()) as { purchase?: KitchenPurchase; error?: string };
    if (res.ok && data.purchase) {
      setPurchases((prev) =>
        prev.map((p) => (p.id === editingPurchaseId ? data.purchase! : p)),
      );
      setEditingPurchaseId(null);
    } else {
      setError(data.error ?? "Failed to update purchase");
    }
  }

  const headcountForCalc = useMemo(
    () =>
      headcountLines
        .filter((l) => l.headcount.trim() !== "")
        .map((l) => ({
          headcount: Number(l.headcount) || 0,
          daysInPeriod: Number(l.daysInPeriod) || 0,
        })),
    [headcountLines],
  );

  const campusSettingsByIngredientId = useMemo(
    () => new Map(campusSettings.map((s) => [s.ingredient_id, s])),
    [campusSettings],
  );
  const effectivePricesMap = useMemo(
    () => new Map(Object.entries(effectivePrices)),
    [effectivePrices],
  );

  const requirements = useMemo(
    () =>
      buildIngredientRequirements(
        ingredients,
        campusSettingsByIngredientId,
        effectivePricesMap,
        headcountForCalc,
        month,
      ),
    [ingredients, campusSettingsByIngredientId, effectivePricesMap, headcountForCalc, month],
  );

  const requirementsByCategory = useMemo(() => {
    const groups = new Map<string, typeof requirements>();
    for (const r of requirements) {
      const list = groups.get(r.ingredient.category) ?? [];
      list.push(r);
      groups.set(r.ingredient.category, list);
    }
    return groups;
  }, [requirements]);

  const estimatedTotalCost = requirements.reduce((sum, r) => sum + r.estimatedCost, 0);
  const actualTotalSpend = purchases.reduce((sum, p) => sum + Number(p.total_cost), 0);
  const budgetNumber = Number(budgetAmount) || 0;
  const savingsOrOverspend = budgetNumber - actualTotalSpend;

  const personDays = useMemo(
    () => headcountForCalc.reduce((sum, l) => sum + l.headcount * l.daysInPeriod, 0),
    [headcountForCalc],
  );
  const campusName = schools.find((s) => s.id === schoolId)?.name ?? "Campus";

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-2 z-10 rounded-[var(--radius)] border border-card-border bg-card/95 p-4 shadow-[var(--shadow-lg)] backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
              {campusName} · {month}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {loading
                ? "Loading sheet-backed figures…"
                : `${headcountForCalc.length} headcount lines · ${personDays.toLocaleString()} person-days`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
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
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Month
              </span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {(
            [
              ["Person-days", personDays.toLocaleString(), null],
              ["Est. requirements", formatTzs(estimatedTotalCost), null],
              ["Budget", formatTzs(budgetNumber), null],
              [
                budgetNumber === 0
                  ? "Budget status"
                  : savingsOrOverspend >= 0
                    ? "Under budget"
                    : "Over budget",
                budgetNumber === 0 ? "No budget set" : formatTzs(Math.abs(savingsOrOverspend)),
                budgetNumber === 0 ? null : savingsOrOverspend >= 0,
              ],
            ] as const
          ).map(([label, value, good]) => (
            <div
              key={label}
              className={`rounded-[var(--radius-sm)] border px-3 py-2.5 ${
                good === true
                  ? "border-success/30 bg-success-15"
                  : good === false
                    ? "border-danger/30 bg-danger-15"
                    : "border-card-border bg-white/70"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                {label}
              </p>
              <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-ink">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          A · DETAIL headcount
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Headcount lines</h2>
        <p className="mt-1 text-sm text-ink-muted">
          One line per category — each has its own headcount, days in the period, and
          price per person (matches the campus month DETAIL block).
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {headcountLines.map((line, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-[var(--radius-sm)] border border-card-border p-2 sm:grid-cols-6"
            >
              <select
                value={
                  HEADCOUNT_CATEGORY_PRESETS.some((c) => c.value === line.category)
                    ? line.category
                    : "other"
                }
                onChange={(e) =>
                  updateLine(i, {
                    category: e.target.value,
                    label: e.target.value === "other" ? line.label : "",
                  })
                }
                className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink sm:col-span-2"
              >
                {HEADCOUNT_CATEGORY_PRESETS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {line.category === "other" ? (
                <input
                  type="text"
                  placeholder="Label (e.g. Arusha Modern Staff)"
                  value={line.label}
                  onChange={(e) => updateLine(i, { label: e.target.value })}
                  className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink sm:col-span-2"
                />
              ) : (
                <span className="hidden sm:col-span-2 sm:block" />
              )}
              <input
                type="number"
                min="0"
                placeholder="Headcount"
                value={line.headcount}
                onChange={(e) => updateLine(i, { headcount: e.target.value })}
                className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
              />
              <input
                type="number"
                min="0"
                placeholder="Days in period"
                value={line.daysInPeriod}
                onChange={(e) => updateLine(i, { daysInPeriod: e.target.value })}
                className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  placeholder="Price/person"
                  value={line.pricePerPerson}
                  onChange={(e) => updateLine(i, { pricePerPerson: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="shrink-0 text-xs font-semibold text-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={addLine}
            className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-electric-blue hover:bg-light-blue-30"
          >
            + Add line
          </button>
          <button
            type="button"
            disabled={savingHeadcount}
            onClick={() => void saveHeadcount()}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {savingHeadcount ? "Saving…" : "Save headcount"}
          </button>
        </div>
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          B · Requirements
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">
          Computed ingredient requirements
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Person-days ÷ people-per-kg (or kg/week × weeks) using campus overrides in Ops.
          Menu matrices are not imported — this is the live ratio engine.
        </p>
        {loading ? (
          // Before campus overrides load, every ingredient falls back to its
          // GLOBAL default ratio (see ingredient-calc.ts) -- a real but wrong
          // number, not a placeholder. Hide the table rather than show it.
          <p className="mt-4 text-sm text-ink-muted">Loading campus-specific requirements…</p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-6">
              {[...requirementsByCategory.entries()].map(([category, rows]) => (
                <div key={category}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="mt-2 overflow-x-auto">
                    <ul className="min-w-[480px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
                      {rows.map(({ ingredient, requiredQuantity, estimatedCost }) => (
                        <li
                          key={ingredient.id}
                          className="grid grid-cols-[2fr_1fr_1fr] items-center gap-2 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-ink">{ingredient.name}</span>
                          <span className="text-right text-ink-muted">
                            {requiredQuantity.toFixed(1)} {ingredient.unit}
                          </span>
                          <span className="text-right font-semibold text-electric-blue">
                            TZS {estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-bold text-ink">
              Estimated total:{" "}
              <span className="text-electric-blue">{formatTzs(estimatedTotalCost)}</span>
            </p>
          </>
        )}
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          C · Campus ratios &amp; prices
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">
          Ingredient settings — this campus
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Override the shared default ratio/price per campus — sheet numbers genuinely differ
          campus to campus and are kept as-is.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs font-semibold uppercase text-ink-muted">
                <th className="py-1.5 pr-2">Ingredient</th>
                <th className="py-1.5 pr-2">Method</th>
                <th className="py-1.5 pr-2">Ratio override</th>
                <th className="py-1.5 pr-2">Effective price</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => {
                const setting = campusSettingsByIngredientId.get(ingredient.id);
                const isFlat = ingredient.calc_method === "flat_weekly";
                const effectivePrice =
                  effectivePricesMap.get(ingredient.id) ?? ingredient.default_unit_price;
                return (
                  <tr key={ingredient.id} className="border-b border-card-border/60">
                    <td className="py-1.5 pr-2 font-semibold text-ink">{ingredient.name}</td>
                    <td className="py-1.5 pr-2 text-ink-muted">
                      {isFlat ? "kg/week × weeks" : "people/kg"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {isFlat ? (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.1"
                            placeholder={String(ingredient.kg_per_week ?? "")}
                            defaultValue={setting?.kg_per_week ?? ""}
                            disabled={savingSettingId === ingredient.id}
                            onBlur={(e) =>
                              void saveIngredientSetting(ingredient.id, {
                                kgPerWeek: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                            title="kg per week"
                          />
                          <input
                            type="number"
                            step="0.1"
                            placeholder="weeks/mo"
                            defaultValue={setting?.weeks_in_month ?? ""}
                            disabled={savingSettingId === ingredient.id}
                            onBlur={(e) =>
                              void saveIngredientSetting(ingredient.id, {
                                weeksInMonth: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                            title="weeks in month (matches this campus's own sheet)"
                          />
                        </div>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          placeholder={String(ingredient.people_per_kg ?? "")}
                          defaultValue={setting?.people_per_kg ?? ""}
                          disabled={savingSettingId === ingredient.id}
                          onBlur={(e) =>
                            void saveIngredientSetting(ingredient.id, {
                              peoplePerKg: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                          title="people fed per kg"
                        />
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        defaultValue={effectivePrice}
                        disabled={savingSettingId === ingredient.id}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value && value !== effectivePrice) void recordPrice(ingredient.id, value);
                        }}
                        className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                        title="Recording a new value here saves a new price point for this month, not an overwrite"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          D · Budget
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Budget vs actual</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Enter this campus&apos;s monthly budget here — actual spend is summed
          automatically from the purchases logged below.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Monthly budget (TZS)</span>
            <input
              type="number"
              min="0"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <button
            type="button"
            disabled={savingBudget}
            onClick={() => void saveBudget()}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {savingBudget ? "Saving…" : "Save budget"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-sm)] border border-card-border p-3">
            <p className="text-xs font-semibold uppercase text-ink-muted">Budget</p>
            <p className="mt-1 text-lg font-extrabold text-ink">
              {budgetNumber.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-card-border p-3">
            <p className="text-xs font-semibold uppercase text-ink-muted">Actual spend</p>
            <p className="mt-1 text-lg font-extrabold text-ink">
              {actualTotalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className={`rounded-[var(--radius-sm)] border p-3 ${
              budgetNumber === 0
                ? "border-card-border"
                : savingsOrOverspend >= 0
                  ? "border-success/30 bg-success-15"
                  : "border-danger/30 bg-danger-15"
            }`}
          >
            <p className="text-xs font-semibold uppercase text-ink-muted">
              {budgetNumber === 0 ? "Savings" : savingsOrOverspend >= 0 ? "Savings" : "Overspend"}
            </p>
            {budgetNumber === 0 ? (
              <p className="mt-1 inline-block rounded-full bg-gold-15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                No budget set yet
              </p>
            ) : (
              <p
                className={`mt-1 text-lg font-extrabold ${
                  savingsOrOverspend >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {Math.abs(savingsOrOverspend).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          E · Purchases
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Purchases this month</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Vendor blocks (e.g. Utele / Palate) show here when available.
        </p>
        <form
          onSubmit={(e) => void addPurchase(e)}
          className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Ingredient</span>
            <select
              value={purchaseIngredientId}
              onChange={(e) => {
                setPurchaseIngredientId(e.target.value);
                const found = ingredients.find((i) => i.id === e.target.value);
                const price = found ? effectivePricesMap.get(found.id) ?? found.default_unit_price : 0;
                setPurchaseUnitPrice(String(price));
              }}
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
            <span className="font-semibold text-ink">Quantity</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={purchaseQty}
              onChange={(e) => setPurchaseQty(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Unit price (TZS)</span>
            <input
              type="number"
              min="0"
              value={purchaseUnitPrice}
              onChange={(e) => setPurchaseUnitPrice(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Purchased on</span>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={savingPurchase}
            className="self-end rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {savingPurchase ? "Saving…" : "Add purchase"}
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[640px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {purchases.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No purchases logged yet this month.
            </li>
          ) : (
            purchases.map((p) =>
              editingPurchaseId === p.id ? (
                <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">
                    {p.ingredient_name ?? p.ingredient_id}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editPurchaseQty}
                    onChange={(e) => setEditPurchaseQty(e.target.value)}
                    className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="number"
                    min="0"
                    value={editPurchaseUnitPrice}
                    onChange={(e) => setEditPurchaseUnitPrice(e.target.value)}
                    className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="date"
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => void saveEditPurchase()}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPurchaseId(null)}
                    className="text-xs font-semibold text-ink-muted hover:underline"
                  >
                    Cancel
                  </button>
                </li>
              ) : (
                <li
                  key={p.id}
                  className="grid grid-cols-[2fr_1.3fr_1fr_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">{p.ingredient_name ?? p.ingredient_id}</span>
                  <span className="text-right text-ink-muted">
                    {p.quantity} × {Number(p.unit_price).toLocaleString()}
                  </span>
                  <span className="text-right font-semibold text-electric-blue">
                    {Number(p.total_cost).toLocaleString()}
                  </span>
                  <span className="text-right text-xs text-ink-faint">{p.purchased_on ?? ""}</span>
                  <span className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEditPurchase(p)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removePurchase(p.id)}
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

      {schoolId ? <KitchenStaffRoster schoolId={schoolId} /> : null}
      {schoolId ? (
        <KitchenVendorsPanel
          purchases={purchases}
          monthDate={monthDate}
          schoolId={schoolId}
          ingredients={ingredients}
          onPurchaseAdded={(purchase) => setPurchases((prev) => [purchase, ...prev])}
        />
      ) : null}
      <KitchenIngredientsPanel />
    </div>
  );
}
