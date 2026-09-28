"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  school: SchoolOption;
  busCount: number;
  seatTotal: number;
};

export function CampusHeaderActions({ school, busCount, seatTotal }: Props) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(school.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  function startRename() {
    setName(school.name);
    setError(null);
    setRenaming(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Campus name is required");
      return;
    }
    const ok = await confirm({
      title: "Rename campus?",
      message: `Rename "${school.name}" to "${name.trim()}"?`,
      confirmLabel: "Rename",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as {
        school?: SchoolOption;
        error?: string;
      };
      if (!res.ok || !data.school) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setRenaming(false);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete this campus?",
      message: `Delete campus "${school.name}"? This only works if it has no students or buses left. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/schools/${school.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: true; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setDeleting(false);
    }
  }

  if (renaming) {
    return (
      <>
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
            required
            autoFocus
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="text-xs font-semibold text-ink-muted hover:underline"
          >
            Cancel
          </button>
          {error ? (
            <p className="w-full text-xs font-semibold text-danger">{error}</p>
          ) : null}
        </form>
        {dialog}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {school.name}
        </h2>
        <button
          type="button"
          onClick={startRename}
          className="text-xs font-semibold text-electric-blue hover:underline"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="text-xs font-semibold text-danger hover:underline disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Delete campus"}
        </button>
      </div>
      <div className="text-right">
        <p className="text-xs text-ink-faint">
          {busCount} buses · {seatTotal} seats total
        </p>
        {error ? (
          <p className="mt-1 text-xs font-semibold text-danger">{error}</p>
        ) : null}
      </div>
      {dialog}
    </div>
  );
}
