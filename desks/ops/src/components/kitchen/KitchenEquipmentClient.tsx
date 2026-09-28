"use client";

import { useEffect, useState } from "react";
import type { School } from "@/types/database";
import type {
  KitchenEquipment,
  KitchenEquipmentCategory,
  KitchenEquipmentCondition,
  KitchenEquipmentMaintenanceLog,
} from "@/lib/db/kitchen";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = { schools: School[] };

const CATEGORY_LABELS: Record<KitchenEquipmentCategory, string> = {
  cookware: "Cookware",
  appliance: "Appliance",
  furniture: "Furniture",
  other: "Other",
};

const CONDITION_STYLES: Record<KitchenEquipmentCondition, string> = {
  good: "bg-success-15 text-success",
  fair: "bg-gold-15 text-ink",
  poor: "bg-gold-15 text-ink",
  needs_repair: "bg-danger-15 text-danger",
};

const CONDITION_LABELS: Record<KitchenEquipmentCondition, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  needs_repair: "Needs repair",
};

function defaultSchoolId(schools: School[]) {
  const prefer =
    schools.find((s) => /usa\s*river|usariver/i.test(`${s.name} ${s.slug ?? ""}`)) ?? schools[0];
  return prefer?.id ?? "";
}

function emptyForm() {
  return {
    name: "",
    category: "cookware" as KitchenEquipmentCategory,
    quantity: "1",
    condition: "good" as KitchenEquipmentCondition,
    purchasedOn: "",
    replacementCost: "",
    notes: "",
  };
}

export function KitchenEquipmentClient({ schools }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [equipment, setEquipment] = useState<KitchenEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [maintNote, setMaintNote] = useState<Record<string, string>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editReplacementCost, setEditReplacementCost] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [maintenanceLogs, setMaintenanceLogs] = useState<
    Record<string, KitchenEquipmentMaintenanceLog[]>
  >({});

  async function fetchMaintenanceLog(equipmentId: string) {
    try {
      const res = await fetch(
        `/api/kitchen/equipment-maintenance?equipmentId=${encodeURIComponent(equipmentId)}`,
      );
      const data = (await res.json()) as { entries?: KitchenEquipmentMaintenanceLog[] };
      if (res.ok) {
        setMaintenanceLogs((prev) => ({ ...prev, [equipmentId]: data.entries ?? [] }));
      }
    } catch {
      // maintenance history is supplementary -- equipment list stays usable without it
    }
  }

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kitchen/equipment?schoolId=${encodeURIComponent(schoolId)}`);
        const data = (await res.json()) as { equipment?: KitchenEquipment[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load equipment");
          return;
        }
        const list = data.equipment ?? [];
        setEquipment(list);
        void Promise.all(list.map((eq) => fetchMaintenanceLog(eq.id)));
      } catch {
        setError("Network error loading equipment");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId]);

  async function addEquipment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: form.name.trim(),
          category: form.category,
          quantity: Number(form.quantity) || 1,
          condition: form.condition,
          purchasedOn: form.purchasedOn || undefined,
          replacementCost: form.replacementCost ? Number(form.replacementCost) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { equipment?: KitchenEquipment; error?: string };
      if (!res.ok || !data.equipment) {
        setError(data.error ?? "Failed to add equipment");
        return;
      }
      setEquipment((prev) => [...prev, data.equipment!]);
      setForm(emptyForm());
    } catch {
      setError("Network error adding equipment");
    } finally {
      setSaving(false);
    }
  }

  async function updateCondition(id: string, condition: KitchenEquipmentCondition) {
    const res = await fetch(`/api/kitchen/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    if (res.ok) {
      setEquipment((prev) => prev.map((eq) => (eq.id === id ? { ...eq, condition } : eq)));
    }
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/kitchen/equipment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    if (res.ok) {
      setEquipment((prev) => prev.filter((eq) => eq.id !== id));
    }
  }

  function startEdit(eq: KitchenEquipment) {
    setEditingId(eq.id);
    setEditQuantity(String(eq.quantity));
    setEditReplacementCost(eq.replacement_cost != null ? String(eq.replacement_cost) : "");
    setEditNotes(eq.notes ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/equipment/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(editQuantity) || 1,
        replacementCost: editReplacementCost ? Number(editReplacementCost) : null,
        notes: editNotes.trim() || null,
      }),
    });
    const data = (await res.json()) as { equipment?: KitchenEquipment; error?: string };
    if (res.ok && data.equipment) {
      setEquipment((prev) => prev.map((eq) => (eq.id === editingId ? data.equipment! : eq)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update equipment");
    }
  }

  async function logMaintenance(id: string) {
    const description = (maintNote[id] ?? "").trim();
    if (!description) return;
    setLoggingId(id);
    try {
      const res = await fetch("/api/kitchen/equipment-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId: id, description }),
      });
      if (res.ok) {
        setMaintNote((prev) => ({ ...prev, [id]: "" }));
        void fetchMaintenanceLog(id);
      }
    } finally {
      setLoggingId(null);
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
            {loading ? "Loading…" : `${equipment.length} equipment items`}
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
          Equipment
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Add equipment</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Pots, pans, ovens, cutting boards, furniture — quantity, condition, and replacement
          cost per campus.
        </p>

        <form onSubmit={(e) => void addEquipment(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-semibold text-ink">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Category</span>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as KitchenEquipmentCategory }))
              }
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {(Object.keys(CATEGORY_LABELS) as KitchenEquipmentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quantity</span>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Condition</span>
            <select
              value={form.condition}
              onChange={(e) =>
                setForm((f) => ({ ...f, condition: e.target.value as KitchenEquipmentCondition }))
              }
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {(Object.keys(CONDITION_LABELS) as KitchenEquipmentCondition[]).map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Replacement cost</span>
            <input
              type="number"
              min="0"
              value={form.replacementCost}
              onChange={(e) => setForm((f) => ({ ...f, replacementCost: e.target.value }))}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <div className="lg:col-span-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add equipment"}
            </button>
          </div>
        </form>
      </section>

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-lg font-bold text-ink">Equipment on hand</h2>

        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : equipment.length === 0 ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-6 text-center text-sm text-ink-muted">
            No equipment logged yet for this campus.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {equipment.map((eq) => (
              <li key={eq.id} className="rounded-[var(--radius-sm)] border border-card-border p-3">
                {editingId === eq.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{eq.name}</span>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="font-semibold text-ink">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="w-16 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="font-semibold text-ink">Replacement cost</span>
                      <input
                        type="number"
                        min="0"
                        value={editReplacementCost}
                        onChange={(e) => setEditReplacementCost(e.target.value)}
                        className="w-24 rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Notes"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="min-w-[10rem] flex-1 rounded-[var(--radius-sm)] border border-card-border px-2 py-1 text-sm"
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
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-ink">{eq.name}</span>
                      <span className="ml-2 text-xs text-ink-muted">
                        {CATEGORY_LABELS[eq.category]} · Qty {eq.quantity}
                        {eq.replacement_cost ? ` · Replacement TZS ${Number(eq.replacement_cost).toLocaleString()}` : ""}
                      </span>
                      {eq.notes ? <p className="mt-0.5 text-xs text-ink-muted">{eq.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={eq.condition}
                        onChange={(e) => void updateCondition(eq.id, e.target.value as KitchenEquipmentCondition)}
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${CONDITION_STYLES[eq.condition]}`}
                      >
                        {(Object.keys(CONDITION_LABELS) as KitchenEquipmentCondition[]).map((c) => (
                          <option key={c} value={c}>
                            {CONDITION_LABELS[c]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => startEdit(eq)}
                        className="text-xs font-semibold text-electric-blue hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deactivate(eq.id)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Log a repair/maintenance note…"
                    value={maintNote[eq.id] ?? ""}
                    onChange={(e) => setMaintNote((prev) => ({ ...prev, [eq.id]: e.target.value }))}
                    className="flex-1 rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={loggingId === eq.id}
                    onClick={() => void logMaintenance(eq.id)}
                    className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-xs font-semibold text-electric-blue hover:bg-light-blue-30 disabled:opacity-60"
                  >
                    {loggingId === eq.id ? "Logging…" : "Log"}
                  </button>
                </div>
                {maintenanceLogs[eq.id]?.length ? (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-card-border pt-2">
                    {maintenanceLogs[eq.id]!.map((log) => (
                      <li key={log.id} className="text-xs text-ink-muted">
                        {log.logged_on} — {log.description}
                        {log.cost ? ` · TZS ${Number(log.cost).toLocaleString()}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
