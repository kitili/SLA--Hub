"use client";

import { useEffect, useState } from "react";
import type { KitchenStaffMember, KitchenStaffRole } from "@/lib/db/kitchen";

const ROLE_LABELS: Record<KitchenStaffRole, string> = {
  cook: "Cook",
  head_of_kitchens: "Head of Kitchens",
  other: "Other",
};

export function KitchenStaffRoster({ schoolId }: { schoolId: string }) {
  const [members, setMembers] = useState<KitchenStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<KitchenStaffRole>("cook");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<KitchenStaffRole>("cook");

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kitchen/staff-members?schoolId=${encodeURIComponent(schoolId)}`);
        const data = (await res.json()) as { members?: KitchenStaffMember[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load staff roster");
          return;
        }
        setMembers(data.members ?? []);
      } catch {
        setError("Network error loading staff roster");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/staff-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, name: name.trim(), role }),
      });
      const data = (await res.json()) as { member?: KitchenStaffMember; error?: string };
      if (!res.ok || !data.member) {
        setError(data.error ?? "Failed to add staff member");
        return;
      }
      setMembers((prev) => [...prev, data.member!]);
      setName("");
    } catch {
      setError("Network error adding staff member");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: KitchenStaffMember) {
    setEditingId(member.id);
    setEditName(member.name);
    setEditRole(member.role);
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/kitchen/staff-members/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), role: editRole }),
    });
    const data = (await res.json()) as { member?: KitchenStaffMember; error?: string };
    if (res.ok && data.member) {
      setMembers((prev) => prev.map((m) => (m.id === editingId ? data.member! : m)));
      setEditingId(null);
    } else {
      setError(data.error ?? "Failed to update staff member");
    }
  }

  async function toggleActive(member: KitchenStaffMember) {
    const res = await fetch(`/api/kitchen/staff-members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, active: !m.active } : m)),
      );
    }
  }

  return (
    <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        F · Staff
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Staff roster — this campus</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Deactivate rather than delete when someone leaves — keeps history intact.
      </p>

      <form onSubmit={(e) => void addMember(e)} className="mt-3 flex flex-wrap items-end gap-2">
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
          <span className="font-semibold text-ink">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as KitchenStaffRole)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2"
          >
            {(Object.keys(ROLE_LABELS) as KitchenStaffRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : members.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-4 text-center text-sm text-ink-muted">
          No staff added yet for this campus.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {members.map((m) =>
            editingId === m.id ? (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                />
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as KitchenStaffRole)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1"
                >
                  {(Object.keys(ROLE_LABELS) as KitchenStaffRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
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
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className={m.active ? "text-ink" : "text-ink-faint line-through"}>
                  {m.name}
                </span>
                <span className="text-xs text-ink-muted">{ROLE_LABELS[m.role]}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(m)}
                    className="text-xs font-semibold text-electric-blue hover:underline"
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
