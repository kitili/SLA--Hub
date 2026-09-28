"use client";

import { useMemo, useState } from "react";
import type { PowerUsage } from "@/lib/db/facilities";

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  schools: SchoolOption[];
  initialEntries: PowerUsage[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PowerUsageClient({ schools, initialEntries }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? "—";
  const filtered = useMemo(
    () =>
      campusFilter === "all"
        ? entries
        : entries.filter((e) => e.school_id === campusFilter),
    [entries, campusFilter],
  );
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [page, setPage] = useState(0);
  const pageCount =
    pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () =>
      pageSize === "all"
        ? filtered
        : filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [filtered, pageSize, currentPage],
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [readingDate, setReadingDate] = useState(todayIso);
  const [unitsReceived, setUnitsReceived] = useState("");
  const [unitsSpent, setUnitsSpent] = useState("");
  const [balanceUnits, setBalanceUnits] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEdit(entry: PowerUsage) {
    setShowForm(true);
    setEditingId(entry.id);
    setReadingDate(entry.reading_date);
    setUnitsReceived(entry.units_received != null ? String(entry.units_received) : "");
    setUnitsSpent(entry.units_spent != null ? String(entry.units_spent) : "");
    setBalanceUnits(entry.balance_units != null ? String(entry.balance_units) : "");
    setSchoolId(entry.school_id ?? schools[0]?.id ?? "");
    clearFlash();
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setUnitsReceived("");
    setUnitsSpent("");
    setBalanceUnits("");
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/facilities/power-usage/${editingId}` : "/api/facilities/power-usage",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readingDate,
            unitsReceived: unitsReceived ? Number(unitsReceived) : undefined,
            unitsSpent: unitsSpent ? Number(unitsSpent) : undefined,
            balanceUnits: balanceUnits ? Number(balanceUnits) : undefined,
            schoolId: schoolId || undefined,
          }),
        },
      );
      const data = (await res.json()) as { entry?: PowerUsage; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setEntries((prev) =>
        editingId ? prev.map((e) => (e.id === data.entry!.id ? data.entry! : e)) : [data.entry!, ...prev],
      );
      setPage(0);
      setOkMsg("Entry saved");
      setEditingId(null);
      setUnitsReceived("");
      setUnitsSpent("");
      setBalanceUnits("");
      setShowForm(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/facilities/power-usage/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
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
          onSubmit={submitEntry}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingId ? "Edit reading" : "New reading"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Date</span>
              <input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Units received</span>
              <input
                type="number"
                step="0.01"
                value={unitsReceived}
                onChange={(e) => setUnitsReceived(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Units spent</span>
              <input
                type="number"
                step="0.01"
                value={unitsSpent}
                onChange={(e) => setUnitsSpent(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Balance</span>
              <input
                type="number"
                step="0.01"
                value={balanceUnits}
                onChange={(e) => setBalanceUnits(e.target.value)}
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
                {saving ? "Saving…" : editingId ? "Save changes" : "Save reading"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={cancelForm}
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
              Power log
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (showForm ? cancelForm() : setShowForm(true))}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ New reading"}
              </button>
              <select
                value={campusFilter}
                onChange={(e) => {
                  setCampusFilter(e.target.value);
                  setPage(0);
                }}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                  setPage(0);
                }}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value={25}>Show 25</option>
                <option value={50}>Show 50</option>
                <option value={100}>Show 100</option>
                <option value="all">Show all</option>
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {entries.length === 0
                ? "No power readings yet — log today's reading below."
                : "No readings for this campus."}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-light-blue-30 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Campus</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Receiving units</th>
                    <th className="px-3 py-2 font-semibold">Units spent</th>
                    <th className="px-3 py-2 font-semibold">Balance units</th>
                    <th className="px-3 py-2 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((entry) => (
                    <tr key={entry.id} className="border-t border-card-border">
                      <td className="px-3 py-2 text-ink-muted">
                        {schoolName(entry.school_id)}
                      </td>
                      <td className="px-3 py-2 font-semibold tabular-nums text-ink">
                        {entry.reading_date}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {entry.units_received ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {entry.units_spent ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">
                        {entry.balance_units ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            className="text-xs font-semibold text-electric-blue hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="text-xs font-semibold text-danger hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageSize !== "all" && filtered.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
              <span>
                {currentPage * pageSize + 1}–
                {Math.min(filtered.length, currentPage * pageSize + pageSize)} of{" "}
                {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-light-blue-30 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-1 py-1.5">
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPage >= pageCount - 1}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm font-semibold text-ink-muted hover:bg-light-blue-30 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
