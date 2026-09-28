"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type { KitchenMealSlot, KitchenMenuItem, KitchenMenuPlan } from "@/lib/db/kitchen";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = { schools: School[] };

const MEAL_SLOTS: KitchenMealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
const SLOT_LABELS: Record<KitchenMealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};

function defaultSchoolId(schools: School[]) {
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ?? schools[0];
  return prefer?.id ?? "";
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mondayOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function weekDates(weekStart: string) {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return isoDate(d);
  });
}

export function KitchenMenuPlannerClient({ schools }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [weekStart, setWeekStart] = useState(() => isoDate(mondayOfWeek(new Date())));
  const [items, setItems] = useState<KitchenMenuItem[]>([]);
  const [plans, setPlans] = useState<KitchenMenuPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [picker, setPicker] = useState<{ date: string; slot: KitchenMealSlot; planId?: string } | null>(
    null,
  );
  const [pickerItemId, setPickerItemId] = useState("");
  const [pickerSaving, setPickerSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const weekEnd = days[6];
  const activeItems = useMemo(() => items.filter((i) => i.active), [items]);

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const [itemsRes, plansRes] = await Promise.all([
          fetch("/api/kitchen/menu-items"),
          fetch(
            `/api/kitchen/menu-plans?schoolId=${encodeURIComponent(schoolId)}&start=${weekStart}&end=${weekEnd}`,
          ),
        ]);
        const itemsData = (await itemsRes.json()) as { items?: KitchenMenuItem[]; error?: string };
        const plansData = (await plansRes.json()) as { plans?: KitchenMenuPlan[]; error?: string };
        if (!itemsRes.ok) {
          setError(itemsData.error ?? "Failed to load menu items");
          return;
        }
        if (!plansRes.ok) {
          setError(plansData.error ?? "Failed to load menu plans");
          return;
        }
        setItems(itemsData.items ?? []);
        setPlans(plansData.plans ?? []);
      } catch {
        setError("Network error loading menu");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId, weekStart, weekEnd]);

  async function addMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const res = await fetch("/api/kitchen/menu-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItemName.trim() }),
    });
    const data = (await res.json()) as { item?: KitchenMenuItem; error?: string };
    if (res.ok && data.item) {
      setItems((prev) => [...prev, data.item!]);
      setNewItemName("");
    } else {
      setError(data.error ?? "Failed to add dish");
    }
  }

  async function setMenuItemActive(id: string, active: boolean) {
    const res = await fetch(`/api/kitchen/menu-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = (await res.json()) as { item?: KitchenMenuItem; error?: string };
    if (res.ok && data.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? data.item! : i)));
    } else {
      setError(data.error ?? "Failed to update dish");
    }
  }

  function startEdit(item: KitchenMenuItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/menu-items/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const data = (await res.json()) as { item?: KitchenMenuItem; error?: string };
    if (res.ok && data.item) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? data.item! : i)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update dish");
    }
  }

  async function assignPlan() {
    if (!picker || !pickerItemId) return;
    const res = await fetch("/api/kitchen/menu-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        serveDate: picker.date,
        mealSlot: picker.slot,
        menuItemId: pickerItemId,
      }),
    });
    const data = (await res.json()) as { plan?: KitchenMenuPlan; error?: string };
    if (res.ok && data.plan) {
      const item = items.find((i) => i.id === pickerItemId);
      setPlans((prev) => [...prev, { ...data.plan!, menu_item_name: item?.name }]);
      setPicker(null);
      setPickerItemId("");
    } else {
      setError(data.error ?? "Failed to assign dish");
    }
  }

  async function swapPlan(id: string, menuItemId: string) {
    const res = await fetch(`/api/kitchen/menu-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId }),
    });
    const data = (await res.json()) as { plan?: KitchenMenuPlan; error?: string };
    if (res.ok && data.plan) {
      const item = items.find((i) => i.id === menuItemId);
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...data.plan!, menu_item_name: item?.name } : p)),
      );
      setPicker(null);
      setPickerItemId("");
    } else {
      setError(data.error ?? "Failed to swap dish");
    }
  }

  async function confirmPicker() {
    if (!picker || !pickerItemId || pickerSaving) return;
    setPickerSaving(true);
    try {
      if (picker.planId) {
        await swapPlan(picker.planId, pickerItemId);
      } else {
        await assignPlan();
      }
    } finally {
      setPickerSaving(false);
    }
  }

  async function removePlan(id: string) {
    const prev = plans;
    setPlans((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/menu-plans/${id}`, { method: "DELETE" });
    if (!res.ok) setPlans(prev);
  }

  const campusName = schools.find((s) => s.id === schoolId)?.name ?? "Campus";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            {campusName}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">Week of {weekStart}</p>
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
              Week starting
            </span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(isoDate(mondayOfWeek(new Date(e.target.value))))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">Menu</p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Dish catalog</h2>
        <form onSubmit={(e) => void addMenuItem(e)} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">New dish name</span>
            <input
              type="text"
              placeholder="e.g. Ugali &amp; beans stew"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            Add dish
          </button>
        </form>
        {items.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {items.map((i) =>
              editingId === i.id ? (
                <span
                  key={i.id}
                  className="inline-flex items-center gap-1 rounded-full bg-light-blue-30 px-2 py-1 text-xs font-semibold text-ink-muted"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                </span>
              ) : i.active ? (
                <span
                  key={i.id}
                  className="inline-flex items-center gap-1 rounded-full bg-light-blue-30 px-3 py-1 text-xs font-semibold text-ink-muted"
                >
                  {i.name}
                  <button
                    type="button"
                    onClick={() => startEdit(i)}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void setMenuItemActive(i.id, false)}
                    className="text-danger hover:underline"
                    title="Remove from catalog"
                  >
                    ×
                  </button>
                </span>
              ) : (
                <span
                  key={i.id}
                  className="inline-flex items-center gap-1 rounded-full bg-light-blue-30 px-3 py-1 text-xs font-semibold text-ink-faint opacity-60"
                >
                  {i.name}
                  <span className="text-ink-faint">(inactive)</span>
                  <button
                    type="button"
                    onClick={() => void setMenuItemActive(i.id, true)}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    Reactivate
                  </button>
                </span>
              ),
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            No dishes in the catalog yet — add one above to start planning.
          </p>
        )}
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-lg font-bold text-ink">Week plan</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-muted">
                  <th className="pb-2">Meal</th>
                  {days.map((d) => (
                    <th key={d} className="pb-2">
                      {new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {MEAL_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="py-2 font-semibold text-ink">{SLOT_LABELS[slot]}</td>
                    {days.map((d) => {
                      const plan = plans.find((p) => p.serve_date === d && p.meal_slot === slot);
                      return (
                        <td key={d} className="py-2 align-top">
                          {plan ? (
                            <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-light-blue-30 px-2 py-1 text-xs font-semibold text-ink">
                              {plan.menu_item_name}
                              <button
                                type="button"
                                onClick={() => {
                                  setPicker({ date: d, slot, planId: plan.id });
                                  setPickerItemId(plan.menu_item_id);
                                }}
                                className="text-xs font-semibold text-electric-blue hover:underline"
                                title="Swap dish"
                              >
                                Swap
                              </button>
                              <button
                                type="button"
                                onClick={() => void removePlan(plan.id)}
                                className="text-danger hover:underline"
                              >
                                ×
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPicker({ date: d, slot })}
                              className="text-xs font-semibold text-electric-blue hover:underline"
                            >
                              + Add
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {picker ? (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-[var(--radius-sm)] border border-card-border p-3">
            <span className="text-sm font-semibold text-ink">
              {picker.planId ? "Swap" : SLOT_LABELS[picker.slot]} · {picker.date}
            </span>
            <select
              value={pickerItemId}
              onChange={(e) => setPickerItemId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-sm text-ink"
            >
              <option value="">Choose a dish…</option>
              {activeItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void confirmPicker()}
              disabled={pickerSaving || !pickerItemId}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {picker.planId ? "Save" : "Assign"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPicker(null);
                setPickerItemId("");
              }}
              className="text-sm font-semibold text-ink-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
