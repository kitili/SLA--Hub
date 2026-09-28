"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type { FarmInput } from "@/lib/db/farm";

type MovementReason = "restock" | "used" | "adjustment" | "waste";

const REASONS: MovementReason[] = ["restock", "used", "adjustment", "waste"];

type RowState = {
  reason: MovementReason;
  qty: string;
  saving: boolean;
  error: string | null;
};

type Props = {
  initialInputs: FarmInput[];
};

export function InputsClient({ initialInputs }: Props) {
  const router = useRouter();
  const [inputs, setInputs] = useState(initialInputs);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [quantityOnHand, setQuantityOnHand] = useState("0");
  const [reorderThreshold, setReorderThreshold] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  function getRow(id: string): RowState {
    return (
      rowState[id] ?? {
        reason: "restock",
        qty: "",
        saving: false,
        error: null,
      }
    );
  }

  function patchRow(id: string, patch: Partial<RowState>) {
    setRowState((prev) => ({ ...prev, [id]: { ...getRow(id), ...patch } }));
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setUnit("kg");
    setQuantityOnHand("0");
    setReorderThreshold("0");
    setNotes("");
  }

  function startEdit(input: FarmInput) {
    setEditingId(input.id);
    setName(input.name);
    setUnit(input.unit);
    setQuantityOnHand(String(input.quantity_on_hand));
    setReorderThreshold(String(input.reorder_threshold));
    setNotes(input.notes ?? "");
    setError(null);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this input item?")) return;
    const res = await fetch(`/api/farm/inputs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setInputs((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) resetForm();
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/farm/inputs/${editingId}` : "/api/farm/inputs",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  name: name.trim(),
                  unit: unit.trim() || undefined,
                  reorderThreshold: reorderThreshold ? Number(reorderThreshold) : 0,
                  notes: notes.trim() || null,
                }
              : {
                  name: name.trim(),
                  unit: unit.trim() || undefined,
                  quantityOnHand: quantityOnHand ? Number(quantityOnHand) : 0,
                  reorderThreshold: reorderThreshold ? Number(reorderThreshold) : 0,
                  notes: notes.trim() || undefined,
                },
          ),
        },
      );
      const data = (await res.json()) as {
        input?: FarmInput;
        error?: string;
      };
      if (!res.ok || !data.input) {
        setError(data.error ?? "Failed to save input");
        return;
      }
      setInputs((prev) =>
        isEdit
          ? prev.map((i) => (i.id === data.input!.id ? data.input! : i)).sort((a, b) => a.name.localeCompare(b.name))
          : [...prev, data.input!].sort((a, b) => a.name.localeCompare(b.name)),
      );
      resetForm();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function submitMovement(id: string) {
    const row = getRow(id);
    const raw = row.qty.trim();
    if (!raw) {
      patchRow(id, { error: "Enter a quantity." });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      patchRow(id, { error: "Invalid quantity." });
      return;
    }

    let delta: number;
    if (row.reason === "restock") {
      delta = Math.abs(n);
    } else if (row.reason === "used" || row.reason === "waste") {
      delta = -Math.abs(n);
    } else {
      delta = n;
    }

    patchRow(id, { saving: true, error: null });
    try {
      const res = await fetch(`/api/farm/inputs/${id}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason: row.reason }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        patchRow(id, {
          saving: false,
          error: data.error ?? "Failed to record movement",
        });
        return;
      }
      setInputs((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity_on_hand: i.quantity_on_hand + delta,
                last_restocked_on:
                  row.reason === "restock"
                    ? new Date().toISOString().slice(0, 10)
                    : i.last_restocked_on,
              }
            : i,
        ),
      );
      patchRow(id, { saving: false, qty: "", error: null });
      router.refresh();
    } catch {
      patchRow(id, { saving: false, error: "Network error." });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {editingId ? "Edit input item" : "New input item"}
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. DAP fertilizer"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Unit</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg, litre, bag, piece"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Quantity on hand</span>
            <input
              type="number"
              step="0.01"
              value={quantityOnHand}
              onChange={(e) => setQuantityOnHand(e.target.value)}
              disabled={Boolean(editingId)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink disabled:bg-app-bg"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Reorder threshold</span>
            <input
              type="number"
              step="0.01"
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : editingId ? "Update input" : "Save input"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={resetForm}
            className="ml-2 mt-4 rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted"
          >
            Cancel
          </button>
        ) : null}
      </form>

      <section>
        <h2 className="text-lg font-bold text-electric-blue">
          Inputs ({inputs.length})
        </h2>

        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {inputs.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No input items yet.
            </li>
          ) : (
            inputs.map((i) => {
              const row = getRow(i.id);
              const lowStock = i.quantity_on_hand <= i.reorder_threshold;
              return (
                <li key={i.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{i.name}</p>
                        {lowStock ? (
                          <span className="rounded-full bg-danger-15 px-2 py-0.5 text-[11px] font-bold text-danger">
                            Low stock
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink-muted">
                        {i.quantity_on_hand.toLocaleString()} {i.unit} on hand
                        · reorder at {i.reorder_threshold.toLocaleString()}{" "}
                        {i.unit}
                      </p>
                      {i.notes ? (
                        <p className="mt-1 text-xs text-ink-faint">
                          {i.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-faint">
                        Last restocked: {i.last_restocked_on ?? "—"}
                      </p>
                      <FarmCrudActions
                        className="mt-2 justify-end"
                        onEdit={() => startEdit(i)}
                        onDelete={() => void deleteRow(i.id)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-ink">Reason</span>
                      <select
                        value={row.reason}
                        onChange={(e) =>
                          patchRow(i.id, {
                            reason: e.target.value as MovementReason,
                          })
                        }
                        className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-ink"
                      >
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-ink">Quantity</span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.qty}
                        onChange={(e) =>
                          patchRow(i.id, { qty: e.target.value })
                        }
                        placeholder={
                          row.reason === "adjustment" ? "±amount" : "amount"
                        }
                        className="w-28 rounded-[var(--radius-sm)] border border-card-border px-2 py-1.5 text-ink"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={row.saving}
                      onClick={() => void submitMovement(i.id)}
                      className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                    >
                      {row.saving ? "Saving…" : "Adjust stock"}
                    </button>
                  </div>
                  {row.error ? (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {row.error}
                    </p>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
