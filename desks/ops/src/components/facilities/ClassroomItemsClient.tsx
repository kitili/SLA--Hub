"use client";

import { useMemo, useState } from "react";
import type { ClassroomItem } from "@/lib/db/facilities";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  schools: SchoolOption[];
  initialItems: ClassroomItem[];
};

export function ClassroomItemsClient({ schools, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? "—";
  const filtered = useMemo(
    () =>
      campusFilter === "all"
        ? items
        : items.filter((it) => it.school_id === campusFilter),
    [items, campusFilter],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [grade, setGrade] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEdit(item: ClassroomItem) {
    setShowForm(true);
    setEditingId(item.id);
    setGrade(item.grade ?? "");
    setItemName(item.item_name);
    setQuantity(item.quantity != null ? String(item.quantity) : "");
    setRemarks(item.remarks ?? "");
    setSchoolId(item.school_id ?? "");
    clearFlash();
  }

  function cancelEdit() {
    setShowForm(false);
    setEditingId(null);
    setGrade("");
    setItemName("");
    setQuantity("");
    setRemarks("");
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!itemName.trim()) {
      setError("Item name is required");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit
          ? `/api/facilities/classroom-items/${editingId}`
          : "/api/facilities/classroom-items",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grade: grade.trim() || undefined,
            itemName: itemName.trim(),
            quantity: quantity ? Number(quantity) : undefined,
            remarks: remarks.trim() || undefined,
            schoolId: schoolId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { item?: ClassroomItem; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setItems((prev) =>
        isEdit
          ? prev.map((it) => (it.id === data.item!.id ? data.item! : it))
          : [...prev, data.item!],
      );
      setOkMsg(isEdit ? "Item updated" : "Item added");
      cancelEdit();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItemRow(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/facilities/classroom-items/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (editingId === id) cancelEdit();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  return (
    <div className="mt-6">
      {error ? <p className="mb-4 text-sm font-semibold text-danger">{error}</p> : null}
      {okMsg ? <p className="mb-4 text-sm font-semibold text-success">{okMsg}</p> : null}

      <div className={showForm ? "grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start" : "grid gap-8"}>
        {showForm ? (
        <form
          onSubmit={submitItem}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingId ? "Edit item" : "Add item"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Item name</span>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                placeholder="e.g. Student chairs"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Grade</span>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 4"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Quantity</span>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Remarks</span>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Campus</span>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              >
                <option value="">All / none</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Update item" : "Save item"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
        ) : null}

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Inventory
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showForm) cancelEdit();
                  else setShowForm(true);
                }}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ Add item"}
              </button>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {items.length === 0 ? "No items yet." : "No items for this campus."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-ink">{item.item_name}</p>
                    <p className="text-xs text-ink-muted">
                      {schoolName(item.school_id)} · {item.grade ?? "All grades"} · Qty{" "}
                      {item.quantity ?? "—"}
                      {item.remarks ? ` · ${item.remarks}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItemRow(item.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
