"use client";

import { useEffect, useState } from "react";
import type { School } from "@/types/database";
import type { KitchenSupply, KitchenSupplyPurchase } from "@/lib/db/kitchen";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = {
  schools: School[];
  supplies: KitchenSupply[];
};

function emptyNewSupply() {
  return { name: "", unit: "unit", defaultUnitPrice: "" };
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatTzs(n: number) {
  return `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function defaultSchoolId(schools: School[]) {
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ?? schools[0];
  return prefer?.id ?? "";
}

export function KitchenSuppliesClient({ schools, supplies: initialSupplies }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [month, setMonth] = useState(currentMonthValue());
  const [purchases, setPurchases] = useState<KitchenSupplyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplies, setSupplies] = useState(initialSupplies);
  const [newSupply, setNewSupply] = useState(emptyNewSupply());
  const [savingSupply, setSavingSupply] = useState(false);

  const [supplyId, setSupplyId] = useState(initialSupplies[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editPurchasedOn, setEditPurchasedOn] = useState("");

  const monthDate = `${month}-01`;

  useEffect(() => {
    async function load() {
      if (!schoolId || !month) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/kitchen/supply-purchases?schoolId=${encodeURIComponent(schoolId)}&month=${encodeURIComponent(monthDate)}`,
        );
        const data = (await res.json()) as { purchases?: KitchenSupplyPurchase[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load supply purchases");
          return;
        }
        setPurchases(data.purchases ?? []);
      } catch {
        setError("Network error loading supply purchases");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId, month, monthDate]);

  async function addPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!supplyId || !qty) {
      setError("Supply and quantity are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/supply-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          month: monthDate,
          supplyId,
          quantity: Number(qty) || 0,
          unitPrice: Number(unitPrice) || 0,
          purchasedOn: purchasedOn || undefined,
        }),
      });
      const data = (await res.json()) as { purchase?: KitchenSupplyPurchase; error?: string };
      if (!res.ok || !data.purchase) {
        setError(data.error ?? "Failed to record supply purchase");
        return;
      }
      setPurchases((prev) => [data.purchase!, ...prev]);
      setQty("");
      setUnitPrice("");
      setPurchasedOn("");
    } catch {
      setError("Network error recording supply purchase");
    } finally {
      setSaving(false);
    }
  }

  async function removePurchase(id: string) {
    const prev = purchases;
    setPurchases((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/supply-purchases/${id}`, { method: "DELETE" });
    if (!res.ok) setPurchases(prev);
  }

  function startEditPurchase(p: KitchenSupplyPurchase) {
    setEditingId(p.id);
    setEditQty(String(p.quantity));
    setEditUnitPrice(String(p.unit_price));
    setEditPurchasedOn(p.purchased_on ?? "");
  }

  async function saveEditPurchase() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/supply-purchases/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(editQty) || 0,
        unitPrice: Number(editUnitPrice) || 0,
        purchasedOn: editPurchasedOn || null,
      }),
    });
    const data = (await res.json()) as { purchase?: KitchenSupplyPurchase; error?: string };
    if (res.ok && data.purchase) {
      // PATCH's select doesn't join kitchen_supplies, so carry the display name
      // over from the row being replaced (mirrors the same gap in addPurchase).
      setPurchases((prev) =>
        prev.map((p) => (p.id === editingId ? { ...data.purchase!, supply_name: p.supply_name } : p)),
      );
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update supply purchase");
    }
  }

  async function addSupplyType(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupply.name.trim()) return;
    setSavingSupply(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSupply.name.trim(),
          unit: newSupply.unit.trim() || "unit",
          defaultUnitPrice: Number(newSupply.defaultUnitPrice) || 0,
        }),
      });
      const data = (await res.json()) as { supply?: KitchenSupply; error?: string };
      if (!res.ok || !data.supply) {
        setError(data.error ?? "Failed to add supply type");
        return;
      }
      setSupplies((prev) => [...prev, data.supply!]);
      setNewSupply(emptyNewSupply());
    } catch {
      setError("Network error adding supply type");
    } finally {
      setSavingSupply(false);
    }
  }

  const monthTotal = purchases.reduce((sum, p) => sum + Number(p.total_cost), 0);
  const campusName = schools.find((s) => s.id === schoolId)?.name ?? "Campus";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
              {campusName} · {month}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {loading ? "Loading…" : `${purchases.length} purchases this month`}
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
        <p className="mt-3 text-sm font-bold text-ink">
          Month total: <span className="text-electric-blue">{formatTzs(monthTotal)}</span>
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Catalog
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Add a supply type</h2>
        <p className="mt-1 text-sm text-ink-muted">
          For anything not in the 7 seeded supply items.
        </p>
        <form onSubmit={(e) => void addSupplyType(e)} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Name</span>
            <input
              type="text"
              value={newSupply.name}
              onChange={(e) => setNewSupply((s) => ({ ...s, name: e.target.value }))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Unit</span>
            <input
              type="text"
              value={newSupply.unit}
              onChange={(e) => setNewSupply((s) => ({ ...s, unit: e.target.value }))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Reference price (TZS)</span>
            <input
              type="number"
              min="0"
              value={newSupply.defaultUnitPrice}
              onChange={(e) => setNewSupply((s) => ({ ...s, defaultUnitPrice: e.target.value }))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={savingSupply}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {savingSupply ? "Saving…" : "Add supply type"}
          </button>
        </form>
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Supplies
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Log a supply purchase</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Cleaning/consumable items — soap, sanitizer, toilet paper — tracked separately from
          food ingredients. Reference monthly total from the 2026 Kitchens Master Sheet: TZS
          273,000 (source tab has no campus attribution, so it&apos;s not pre-filled anywhere).
        </p>

        <form onSubmit={(e) => void addPurchase(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Supply</span>
            <select
              value={supplyId}
              onChange={(e) => {
                setSupplyId(e.target.value);
                const found = supplies.find((s) => s.id === e.target.value);
                setUnitPrice(found ? String(found.default_unit_price) : "");
              }}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.unit})
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
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Unit price (TZS)</span>
            <input
              type="number"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Purchased on</span>
            <input
              type="date"
              value={purchasedOn}
              onChange={(e) => setPurchasedOn(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="self-end rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add purchase"}
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[640px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {purchases.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No supply purchases logged yet this month.
            </li>
          ) : (
            purchases.map((p) =>
              editingId === p.id ? (
                <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{p.supply_name ?? p.supply_id}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-20 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="number"
                    min="0"
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(e.target.value)}
                    className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                  />
                  <input
                    type="date"
                    value={editPurchasedOn}
                    onChange={(e) => setEditPurchasedOn(e.target.value)}
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
                    onClick={() => setEditingId(null)}
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
                  <span className="font-semibold text-ink">{p.supply_name ?? p.supply_id}</span>
                  <span className="text-right text-ink-muted">
                    {p.quantity} × {Number(p.unit_price).toLocaleString()}
                  </span>
                  <span className="text-right font-semibold text-electric-blue">
                    {formatTzs(Number(p.total_cost))}
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
    </div>
  );
}
