"use client";

import { useEffect, useState } from "react";
import type { KitchenDaycareRecord } from "@/lib/db/kitchen";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function KitchenDaycareClient() {
  const [records, setRecords] = useState<KitchenDaycareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(currentMonth());
  const [kidCount, setKidCount] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [menuNotes, setMenuNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/kitchen/daycare");
        const data = (await res.json()) as { records?: KitchenDaycareRecord[]; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to load daycare records");
          return;
        }
        setRecords(data.records ?? []);
      } catch {
        setError("Network error loading daycare records");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/daycare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          kidCount: kidCount.trim() ? Number(kidCount) : null,
          monthlyCost: monthlyCost.trim() ? Number(monthlyCost) : null,
          menuNotes: menuNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { record?: KitchenDaycareRecord; error?: string };
      if (!res.ok || !data.record) {
        setError(data.error ?? "Failed to save daycare record");
        return;
      }
      setRecords((prev) => [data.record!, ...prev.filter((r) => r.month !== data.record!.month)]);
    } catch {
      setError("Network error saving daycare record");
    } finally {
      setSaving(false);
    }
  }

  function editRecord(r: KitchenDaycareRecord) {
    setMonth(r.month);
    setKidCount(r.kid_count !== null ? String(r.kid_count) : "");
    setMonthlyCost(r.monthly_cost !== null ? String(r.monthly_cost) : "");
    setMenuNotes(r.menu_notes ?? "");
  }

  async function removeRecord(id: string) {
    const prev = records;
    setRecords((r) => r.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/daycare/${id}`, { method: "DELETE" });
    if (!res.ok) setRecords(prev);
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
          Daycare
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">
          Log kid count, menu, and cost
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Not one of the 5 campuses — a standalone monthly record, one row per month.
        </p>

        <form onSubmit={(e) => void save(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Month</span>
            <input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(`${e.target.value}-01`)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Kid count</span>
            <input
              type="number"
              min="0"
              value={kidCount}
              onChange={(e) => setKidCount(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Monthly cost (TZS)</span>
            <input
              type="number"
              min="0"
              value={monthlyCost}
              onChange={(e) => setMonthlyCost(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Menu notes</span>
            <input
              type="text"
              value={menuNotes}
              onChange={(e) => setMenuNotes(e.target.value)}
              placeholder="e.g. Monday: Porridge, Rice & Beans"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <div className="lg:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save month"}
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <ul className="min-w-[560px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
            {loading ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">Loading…</li>
            ) : records.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">
                No daycare records logged yet.
              </li>
            ) : (
              records.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_1fr_1.6fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">{r.month.slice(0, 7)}</span>
                  <span className="text-ink-muted">
                    {r.kid_count !== null ? `${r.kid_count} kids` : "— kids"}
                  </span>
                  <span className="text-ink-muted">
                    {r.monthly_cost !== null
                      ? `${r.monthly_cost.toLocaleString()} ${r.currency}`
                      : "— cost"}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => editRecord(r)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRecord(r.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
