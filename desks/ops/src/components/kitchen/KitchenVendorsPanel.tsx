"use client";

import { useEffect, useState } from "react";
import type { KitchenIngredient, KitchenPurchase, KitchenVendor } from "@/lib/db/kitchen";

function formatMoney(n: number) {
  return `TZS ${Math.round(n).toLocaleString()}`;
}

/** Groups this month's purchases by vendor -- most purchases have no vendor
 * (cooks logging day-to-day buys), only the two real recurring ones
 * (Utele/Palate) imported from the master sheet do. Hidden behind a
 * show/hide toggle by default since a vendor's full purchase history can
 * get long and this sits inside an already-dense page. */
function VendorPurchases({
  vendorId,
  vendorName,
  purchases,
  monthDate,
  schoolId,
  ingredients,
  onPurchaseAdded,
}: {
  vendorId: string;
  vendorName: string;
  purchases: KitchenPurchase[];
  monthDate: string;
  schoolId: string;
  ingredients: KitchenIngredient[];
  onPurchaseAdded: (purchase: KitchenPurchase) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const rows = purchases.filter((p) => p.vendor_id === vendorId);
  const total = rows.reduce((sum, r) => sum + r.total_cost, 0);
  const monthLabel = new Date(monthDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const computedTotal = (Number(qty) || 0) * (Number(unitPrice) || 0);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!ingredientId || !qty) {
      setAddError("Item and quantity are required.");
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/kitchen/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          month: monthDate,
          ingredientId,
          quantity: Number(qty) || 0,
          unitPrice: Number(unitPrice) || 0,
          vendorId,
        }),
      });
      const data = (await res.json()) as { purchase?: KitchenPurchase; error?: string };
      if (!res.ok || !data.purchase) {
        setAddError(data.error ?? "Failed to add item");
        return;
      }
      onPurchaseAdded(data.purchase);
      setQty("");
      setUnitPrice("");
    } catch {
      setAddError("Network error adding item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-electric-blue hover:underline"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        {expanded ? "Hide" : "Show"} items supplied {rows.length > 0 ? `(${rows.length})` : ""}
      </button>

      {expanded ? (
        <div className="mt-2">
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-card-border">
              <p className="bg-light-blue-30 px-3 py-2 text-sm font-bold text-ink">
                {vendorName} {monthLabel}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy text-white">
                    <th className="px-3 py-2 text-left font-semibold">Item / Description</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-card-border">
                      <td className="px-3 py-2 text-ink">{r.ingredient_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-ink">{r.quantity}</td>
                      <td className="px-3 py-2 text-right text-ink">{formatMoney(r.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-ink">{formatMoney(r.total_cost)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-card-border bg-white/60 font-bold">
                    <td className="px-3 py-2 text-ink" colSpan={3}>
                      TOTAL
                    </td>
                    <td className="px-3 py-2 text-right text-ink">{formatMoney(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-3 py-3 text-center text-xs text-ink-muted">
              No items logged for {vendorName} in {monthLabel} yet.
            </p>
          )}

          <form
            onSubmit={(e) => void addItem(e)}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 p-3"
          >
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink">Item / description</span>
              <select
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm"
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink">Qty</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink">Unit price (TZS)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-28 rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink">Total</span>
              <span className="px-2 py-1.5 text-sm font-semibold text-ink">
                {formatMoney(computedTotal)}
              </span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add item"}
            </button>
            {addError ? <p className="w-full text-xs text-danger">{addError}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function KitchenVendorsPanel({
  purchases = [],
  monthDate,
  schoolId,
  ingredients = [],
  onPurchaseAdded,
}: {
  purchases?: KitchenPurchase[];
  monthDate?: string;
  schoolId?: string;
  ingredients?: KitchenIngredient[];
  onPurchaseAdded?: (purchase: KitchenPurchase) => void;
}) {
  const [vendors, setVendors] = useState<KitchenVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [itemIngredientId, setItemIngredientId] = useState(ingredients[0]?.id ?? "");
  const [itemQty, setItemQty] = useState("");
  const [itemUnitPrice, setItemUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/kitchen/vendors");
        const data = (await res.json()) as { vendors?: KitchenVendor[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load vendors");
          return;
        }
        setVendors(data.vendors ?? []);
      } catch {
        setError("Network error loading vendors");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function addVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { vendor?: KitchenVendor; error?: string };
      if (!res.ok || !data.vendor) {
        setError(data.error ?? "Failed to add vendor");
        return;
      }
      setVendors((prev) => [...prev, data.vendor!]);

      // Item fields are optional -- only log a first purchase if a quantity
      // was actually entered, so a plain vendor-only add still works exactly
      // as before.
      if (itemQty && itemIngredientId && schoolId && monthDate && onPurchaseAdded) {
        const purchaseRes = await fetch("/api/kitchen/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            month: monthDate,
            ingredientId: itemIngredientId,
            quantity: Number(itemQty) || 0,
            unitPrice: Number(itemUnitPrice) || 0,
            vendorId: data.vendor.id,
          }),
        });
        const purchaseData = (await purchaseRes.json()) as {
          purchase?: KitchenPurchase;
          error?: string;
        };
        if (purchaseRes.ok && purchaseData.purchase) {
          onPurchaseAdded(purchaseData.purchase);
        } else {
          setError(purchaseData.error ?? "Vendor added, but failed to log the item");
        }
      }

      setName("");
      setContactPerson("");
      setContactPhone("");
      setItemQty("");
      setItemUnitPrice("");
    } catch {
      setError("Network error adding vendor");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(v: KitchenVendor) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditPerson(v.contact_person ?? "");
    setEditPhone(v.contact_phone ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/vendors/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        contactPerson: editPerson.trim() || null,
        contactPhone: editPhone.trim() || null,
      }),
    });
    const data = (await res.json()) as { vendor?: KitchenVendor; error?: string };
    if (res.ok && data.vendor) {
      setVendors((prev) => prev.map((v) => (v.id === editingId ? data.vendor! : v)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update vendor");
    }
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/kitchen/vendors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    if (res.ok) {
      setVendors((prev) => prev.filter((v) => v.id !== id));
    }
  }

  return (
    <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        G · Vendors
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Vendors / suppliers</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Utele and Palate are already linked to logged purchases.
      </p>

      <form onSubmit={(e) => void addVendor(e)} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Contact person</span>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Phone</span>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          />
        </label>

        {ingredients.length > 0 && schoolId && monthDate ? (
          <>
            <span className="w-full text-xs font-semibold uppercase tracking-wide text-ink-muted">
              First item supplied (optional)
            </span>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Item / description</span>
              <select
                value={itemIngredientId}
                onChange={(e) => setItemIngredientId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Qty</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                className="w-24 rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Unit price (TZS)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={itemUnitPrice}
                onChange={(e) => setItemUnitPrice(e.target.value)}
                className="w-28 rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Total</span>
              <span className="px-3 py-2 text-sm font-semibold text-ink">
                {formatMoney((Number(itemQty) || 0) * (Number(itemUnitPrice) || 0))}
              </span>
            </label>
          </>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add vendor"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : vendors.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-4 text-center text-sm text-ink-muted">
          No vendors yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {vendors.map((v) =>
            editingId === v.id ? (
              <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                />
                <input
                  type="text"
                  placeholder="Contact person"
                  value={editPerson}
                  onChange={(e) => setEditPerson(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
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
              <li key={v.id} className="px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{v.name}</span>
                  <span className="text-xs text-ink-muted">
                    {v.contact_person ?? ""} {v.contact_phone ? `· ${v.contact_phone}` : ""}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deactivate(v.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Deactivate
                    </button>
                  </span>
                </div>
                {monthDate && schoolId && onPurchaseAdded ? (
                  <VendorPurchases
                    vendorId={v.id}
                    vendorName={v.name}
                    purchases={purchases}
                    monthDate={monthDate}
                    schoolId={schoolId}
                    ingredients={ingredients}
                    onPurchaseAdded={onPurchaseAdded}
                  />
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
