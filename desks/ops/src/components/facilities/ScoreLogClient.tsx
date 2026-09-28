"use client";

import { useMemo, useState } from "react";

type SchoolOption = { id: string; name: string; slug: string };

export type ScoreEntry = {
  id: string;
  school_id: string | null;
  label: string;
  date: string;
  score: number;
  comments: string | null;
  inspector: string | null;
};

const SCORE_LABEL: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

function scoreTone(score: number) {
  if (score >= 4) return "bg-success-15 text-success";
  if (score === 3) return "bg-gold-15 text-ink-muted";
  return "bg-danger-15 text-danger";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

type Props = {
  title: string;
  itemLabel: string;
  /**
   * Fixed choices matching the paper/master-sheet process — Kusaduka picks
   * from exactly these, same as the physical sheet Baraka laid out. No
   * free text here so entries stay consistent across campuses.
   */
  itemOptions: string[];
  apiPath: string;
  labelBodyKey: string;
  dateBodyKey: string;
  schools: SchoolOption[];
  initialEntries: ScoreEntry[];
  loadError?: string | null;
  defaultView?: "matrix" | "list";
  defaultListOrder?: "latest" | "oldest";
};

export function ScoreLogClient({
  title,
  itemLabel,
  itemOptions,
  apiPath,
  labelBodyKey,
  dateBodyKey,
  schools,
  initialEntries,
  loadError,
  defaultView = "list",
  defaultListOrder = "latest",
}: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [view, setView] = useState<"matrix" | "list">(defaultView);
  const [listOrder, setListOrder] = useState<"latest" | "oldest">(defaultListOrder);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [itemValue, setItemValue] = useState(itemOptions[0] ?? "");
  const [date, setDate] = useState(todayIso);
  const [score, setScore] = useState(4);
  const [comments, setComments] = useState("");
  const [inspector, setInspector] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function startEdit(entry: ScoreEntry) {
    setShowForm(true);
    setEditingId(entry.id);
    setItemValue(entry.label);
    setDate(entry.date);
    setScore(entry.score);
    setComments(entry.comments ?? "");
    setInspector(entry.inspector ?? "");
    setSchoolId(entry.school_id ?? schools[0]?.id ?? "");
    clearFlash();
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setItemValue(itemOptions[0] ?? "");
    setComments("");
    setInspector("");
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!itemValue.trim()) {
      setError(`${itemLabel} is required`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `${apiPath}/${editingId}` : apiPath, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [labelBodyKey]: itemValue.trim(),
          [dateBodyKey]: date,
          score,
          comments: comments.trim() || undefined,
          inspector: inspector.trim() || undefined,
          schoolId: schoolId || undefined,
        }),
      });
      const data = (await res.json()) as {
        score?: {
          id: string;
          area?: string;
          task?: string;
          walkthrough_date?: string;
          log_date?: string;
          score: number;
          comments: string | null;
          inspector: string | null;
          school_id: string | null;
        };
        log?: {
          id: string;
          area?: string;
          task?: string;
          walkthrough_date?: string;
          log_date?: string;
          score: number;
          comments: string | null;
          inspector: string | null;
          school_id: string | null;
        };
        error?: string;
      };
      const saved = data.score ?? data.log;
      if (!res.ok || !saved) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      const entry: ScoreEntry = {
        id: saved.id,
        school_id: saved.school_id,
        label: saved.area ?? saved.task ?? itemValue.trim(),
        date: saved.walkthrough_date ?? saved.log_date ?? date,
        score: saved.score,
        comments: saved.comments,
        inspector: saved.inspector,
      };
      setEntries((prev) =>
        editingId ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev],
      );
      setOkMsg("Saved");
      setEditingId(null);
      setItemValue(itemOptions[0] ?? "");
      setComments("");
      setInspector("");
      setShowForm(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.slice(0, 7)));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (campusFilter !== "all" && e.school_id !== campusFilter) return false;
        if (monthFilter !== "all" && !e.date.startsWith(monthFilter)) return false;
        return true;
      }),
    [entries, campusFilter, monthFilter],
  );

  const listEntries = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) {
        return listOrder === "latest" ? -dateCmp : dateCmp;
      }
      const labelCmp = a.label.localeCompare(b.label);
      if (labelCmp !== 0) return labelCmp;
      return a.id.localeCompare(b.id);
    });
  }, [filtered, listOrder]);

  const avgScore = useMemo(() => {
    if (filtered.length === 0) return null;
    return Math.round((filtered.reduce((s, e) => s + e.score, 0) / filtered.length) * 10) / 10;
  }, [filtered]);

  const matrix = useMemo(() => {
    const dates = [...new Set(filtered.map((e) => e.date))].sort();
    const labels = [...new Set(filtered.map((e) => e.label))].sort((a, b) =>
      a.localeCompare(b),
    );
    const byKey = new Map<string, ScoreEntry>();
    for (const e of filtered) byKey.set(`${e.label}::${e.date}`, e);
    return { dates, labels, byKey };
  }, [filtered]);

  return (
    <div className="mt-6">
      {loadError ? (
        <p className="mb-4 rounded-(--radius-sm) border border-danger/40 bg-danger-15 px-4 py-3 text-sm text-ink">
          Could not load scores: <span className="font-semibold">{loadError}</span>
        </p>
      ) : null}
      {error ? <p className="mb-4 text-sm font-semibold text-danger">{error}</p> : null}
      {okMsg ? <p className="mb-4 text-sm font-semibold text-success">{okMsg}</p> : null}

      <div className={showForm ? "grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start" : "grid gap-8"}>
        {showForm ? (
          <form
            onSubmit={submitEntry}
            className="rounded-(--radius) border border-card-border bg-card p-4 shadow-brand"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {editingId ? `Edit ${title.toLowerCase()} entry` : `New ${title.toLowerCase()} entry`}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">{itemLabel}</span>
                <select
                  value={itemValue}
                  onChange={(e) => setItemValue(e.target.value)}
                  required
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                >
                  {itemOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Score (1-5)</span>
                <select
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {SCORE_LABEL[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Campus</span>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                >
                  <option value="">All / none</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Inspector</span>
                <input
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Comments</span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-(--radius-sm) bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Save entry"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="rounded-(--radius-sm) border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-light-blue-30"
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
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {title}
              </h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                {filtered.length} scores
                {avgScore !== null ? ` · avg ${avgScore}/5` : ""}
                {matrix.dates.length ? ` · ${matrix.dates.length} dates` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (showForm ? cancelForm() : setShowForm(true))}
                className="rounded-(--radius-sm) bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ New entry"}
              </button>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={listOrder}
                onChange={(e) => setListOrder(e.target.value as "latest" | "oldest")}
                className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <div className="inline-flex rounded-(--radius-sm) border border-card-border">
                <button
                  type="button"
                  onClick={() => setView("matrix")}
                  className={`px-3 py-1.5 text-sm font-semibold ${
                    view === "matrix"
                      ? "bg-electric-blue text-white"
                      : "bg-card text-ink-muted"
                  }`}
                >
                  Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`px-3 py-1.5 text-sm font-semibold ${
                    view === "list"
                      ? "bg-electric-blue text-white"
                      : "bg-card text-ink-muted"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {entries.length === 0
                ? "No scores logged yet — add an entry to get started."
                : "No scores match these filters — try All months."}
            </p>
          ) : view === "matrix" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              <div className="overflow-x-auto rounded-(--radius) border border-card-border bg-card shadow-brand">
                <table className="border-collapse text-left text-xs">
                  <thead className="bg-light-blue-30 text-ink-muted">
                    <tr>
                      <th className="sticky left-0 z-10 bg-light-blue-30 px-3 py-2 font-semibold">
                        {itemLabel}
                      </th>
                      {matrix.dates.map((d) => (
                        <th
                          key={d}
                          className="px-2 py-2 text-center font-semibold tabular-nums"
                          title={d}
                        >
                          {shortDate(d)}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.labels.map((label) => {
                      const scores = matrix.dates
                        .map((d) => matrix.byKey.get(`${label}::${d}`)?.score)
                        .filter((n): n is number => typeof n === "number");
                      const rowAvg =
                        scores.length > 0
                          ? Math.round(
                              (scores.reduce((s, n) => s + n, 0) / scores.length) * 10,
                            ) / 10
                          : null;
                      return (
                        <tr key={label} className="border-t border-card-border">
                          <td className="sticky left-0 z-10 max-w-56 truncate bg-card px-3 py-1.5 font-medium text-ink">
                            {label}
                          </td>
                          {matrix.dates.map((d) => {
                            const cell = matrix.byKey.get(`${label}::${d}`);
                            return (
                              <td key={d} className="px-1 py-1 text-center">
                                {cell ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedKey((k) =>
                                        k === `${label}::${d}` ? null : `${label}::${d}`,
                                      )
                                    }
                                    className={`relative inline-block min-w-6 rounded px-1 py-0.5 font-bold tabular-nums ${scoreTone(cell.score)} ${
                                      selectedKey === `${label}::${d}`
                                        ? "ring-2 ring-electric-blue"
                                        : ""
                                    }`}
                                    title={cell.comments ?? SCORE_LABEL[cell.score]}
                                  >
                                    {cell.score}
                                    {cell.comments || cell.inspector ? (
                                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-electric-blue" />
                                    ) : null}
                                  </button>
                                ) : (
                                  <span className="text-ink-faint">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1 text-center font-semibold tabular-nums text-ink-muted">
                            {rowAvg ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-(--radius) border border-card-border bg-card p-4 shadow-brand">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Matrix details
                </h3>
                {selectedKey ? (() => {
                  const cell = matrix.byKey.get(selectedKey);
                  if (!cell) return null;
                  const [cellLabel, cellDate] = selectedKey.split("::");
                  return (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-ink">
                        {cellLabel}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{cellDate}</p>
                      <p className="mt-3 text-sm text-ink-muted">
                        Score: {cell.score} — {SCORE_LABEL[cell.score]}
                        {cell.inspector ? ` · Inspector: ${cell.inspector}` : ""}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap border-t border-card-border pt-3 text-sm text-ink-muted">
                        {cell.comments ?? "No comments entered for this one."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(null)}
                        className="mt-4 text-xs font-semibold text-electric-blue hover:underline"
                      >
                        Clear selection
                      </button>
                    </div>
                  );
                })() : (
                  <p className="mt-3 text-sm text-ink-muted">
                    Click a score in the matrix to read the comments, inspector, and score label.
                  </p>
                )}
              </aside>
            </div>
          ) : null}

          {filtered.length > 0 && view === "list" ? (
            <div className="overflow-x-auto rounded-(--radius) border border-card-border bg-card shadow-brand">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-light-blue-30 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{itemLabel}</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Score</th>
                    <th className="px-3 py-2 font-semibold">Comments</th>
                    <th className="px-3 py-2 font-semibold">Inspector</th>
                    <th className="px-3 py-2 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {listEntries.map((e) => (
                    <tr key={e.id} className="border-t border-card-border">
                      <td className="px-3 py-2 font-semibold text-ink">{e.label}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-muted">{e.date}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreTone(e.score)}`}
                        >
                          {e.score} — {SCORE_LABEL[e.score]}
                        </span>
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-ink-muted">
                        {e.comments ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{e.inspector ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(e)}
                            className="text-xs font-semibold text-electric-blue hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(e.id)}
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
