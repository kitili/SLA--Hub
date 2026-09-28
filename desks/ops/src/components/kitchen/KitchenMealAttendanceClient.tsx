"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type { KitchenHeadcountLine, KitchenMealAttendance, KitchenMealSlot } from "@/lib/db/kitchen";
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

export function KitchenMealAttendanceClient({ schools }: Props) {
  const [schoolId, setSchoolId] = useSelectedKitchenCampus(schools, defaultSchoolId(schools));
  const [attendance, setAttendance] = useState<KitchenMealAttendance[]>([]);
  const [headcountLines, setHeadcountLines] = useState<KitchenHeadcountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serveDate, setServeDate] = useState("");
  const [mealSlot, setMealSlot] = useState<KitchenMealSlot>("lunch");
  const [actualHeadcount, setActualHeadcount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { today, thirtyDaysAgo, referenceMonth } = useMemo(() => {
    const now = new Date();
    return {
      today: now.toISOString().slice(0, 10),
      thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      referenceMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      setLoading(true);
      setError(null);
      try {
        const [attRes, hcRes] = await Promise.all([
          fetch(
            `/api/kitchen/meal-attendance?schoolId=${encodeURIComponent(schoolId)}&start=${thirtyDaysAgo}&end=${today}`,
          ),
          fetch(
            `/api/kitchen/headcount?schoolId=${encodeURIComponent(schoolId)}&month=${encodeURIComponent(referenceMonth)}`,
          ),
        ]);
        const attData = (await attRes.json()) as { attendance?: KitchenMealAttendance[]; error?: string };
        const hcData = (await hcRes.json()) as { lines?: KitchenHeadcountLine[]; error?: string };
        if (!attRes.ok) {
          setError(attData.error ?? "Failed to load attendance");
          return;
        }
        setAttendance(attData.attendance ?? []);
        setHeadcountLines(hcData.lines ?? []);
      } catch {
        setError("Network error loading attendance");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schoolId, today, thirtyDaysAgo, referenceMonth]);

  const referenceHeadcount = headcountLines.reduce((sum, l) => sum + l.headcount, 0);

  async function addAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!serveDate || !actualHeadcount) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/meal-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          serveDate,
          mealSlot,
          actualHeadcount: Number(actualHeadcount) || 0,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { attendance?: KitchenMealAttendance; error?: string };
      if (!res.ok || !data.attendance) {
        setError(data.error ?? "Failed to save attendance");
        return;
      }
      setAttendance((prev) => [data.attendance!, ...prev.filter((a) => a.id !== data.attendance!.id)]);
      setServeDate("");
      setActualHeadcount("");
      setNotes("");
    } catch {
      setError("Network error saving attendance");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    const prev = attendance;
    setAttendance((a) => a.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/meal-attendance/${id}`, { method: "DELETE" });
    if (!res.ok) setAttendance(prev);
  }

  function editEntry(a: KitchenMealAttendance) {
    setSchoolId(a.school_id);
    setServeDate(a.serve_date);
    setMealSlot(a.meal_slot);
    setActualHeadcount(String(a.actual_headcount));
    setNotes(a.notes ?? "");
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
            {loading
              ? "Loading…"
              : referenceHeadcount > 0
                ? `Reference: ~${referenceHeadcount.toLocaleString()} people planned this campus this month, summed across all headcount categories — a rough guide, not a per-meal figure.`
                : "No headcount logged for this campus this month yet — no reference figure to compare against."}
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
          Attendance
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Log meal attendance</h2>
        <p className="mt-1 text-sm text-ink-muted">
          The headcount actually served/counted at serving time — not pulled from Transport&apos;s
          boarding records, a standalone count kitchen staff take.
        </p>

        <form onSubmit={(e) => void addAttendance(e)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Date</span>
            <input
              type="date"
              value={serveDate}
              onChange={(e) => setServeDate(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Meal</span>
            <select
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value as KitchenMealSlot)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Actual headcount</span>
            <input
              type="number"
              min="0"
              value={actualHeadcount}
              onChange={(e) => setActualHeadcount(e.target.value)}
              required
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-semibold text-ink">Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <div className="lg:col-span-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log attendance"}
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[560px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {attendance.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No attendance logged in the last 30 days.
            </li>
          ) : (
            attendance.map((a) => {
              const delta =
                referenceHeadcount > 0 ? a.actual_headcount - referenceHeadcount : null;
              return (
                <li
                  key={a.id}
                  className="grid grid-cols-[1.6fr_1fr_1.4fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">
                    {a.serve_date} · {SLOT_LABELS[a.meal_slot]}
                  </span>
                  <span className="text-right text-ink-muted">{a.actual_headcount} served</span>
                  <span
                    className={`text-right ${delta === null ? "" : delta >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {delta !== null ? `${delta >= 0 ? "+" : ""}${delta} vs monthly reference` : ""}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => editEntry(a)}
                      className="text-xs font-semibold text-electric-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEntry(a.id)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
        </div>
      </section>
    </div>
  );
}
