"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TripDirection } from "@/types/database";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type SchoolOption = { id: string; name: string };

export function CreateRouteForm({ schools }: { schools: SchoolOption[] }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<TripDirection>("am");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !name.trim()) {
      setError("School and name are required.");
      return;
    }
    const school = schools.find((s) => s.id === schoolId);
    const ok = await confirm({
      title: "Create this route?",
      message: `Create "${name.trim()}" (${direction.toUpperCase()}) for ${school?.name ?? "the selected campus"}?`,
      confirmLabel: "Create route",
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          name: name.trim(),
          direction,
        }),
      });
      const data = (await res.json()) as {
        route?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.route) {
        setError(data.error ?? "Failed to create route");
        return;
      }
      router.push(`/admin/routes/${data.route.id}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
    >
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Campus</span>
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
      <label className="flex min-w-[12rem] flex-[2] flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Route name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Usariver AM Loop"
          className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Direction</span>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as TripDirection)}
          className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
        >
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={saving || schools.length === 0}
        className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create route"}
      </button>
      {error ? (
        <p className="w-full text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {dialog}
    </form>
  );
}
