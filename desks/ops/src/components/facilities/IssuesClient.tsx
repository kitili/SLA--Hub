"use client";

import { useMemo, useState } from "react";
import type { FacilitiesIssue, IssueStatus } from "@/lib/db/facilities";
import { LastEditedBy } from "@/components/ui/LastEditedBy";

type SchoolOption = { id: string; name: string; slug: string };

const STATUSES: IssueStatus[] = ["open", "in_progress", "completed", "cancelled"];

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<IssueStatus, string> = {
  open: "bg-danger-15 text-danger",
  in_progress: "bg-gold-15 text-ink-muted",
  completed: "bg-success-15 text-success",
  cancelled: "bg-gray text-ink-faint",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  schools: SchoolOption[];
  initialIssues: FacilitiesIssue[];
  loadError?: string | null;
  profileLabels?: Record<string, string>;
};

function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function IssuesClient({
  schools,
  initialIssues,
  loadError,
  profileLabels,
}: Props) {
  const [issues, setIssues] = useState(initialIssues);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<IssueStatus>("open");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [reportedBy, setReportedBy] = useState("");
  const [accountable, setAccountable] = useState("");
  const [responsible, setResponsible] = useState("");
  const [reportDate, setReportDate] = useState(todayIso);
  const [deadline, setDeadline] = useState("");
  const [resolvedDate, setResolvedDate] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [logAsExpense, setLogAsExpense] = useState(false);

  function clearFlash() {
    setError(null);
    setOkMsg(null);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setDescription("");
    setStatus("open");
    setReportedBy("");
    setAccountable("");
    setResponsible("");
    setReportDate(todayIso());
    setDeadline("");
    setResolvedDate("");
    setNextSteps("");
    setNotes("");
    setCost("");
    setLogAsExpense(false);
  }

  function startEdit(t: FacilitiesIssue) {
    setShowForm(true);
    setEditingId(t.id);
    setDescription(t.description);
    setStatus(t.status);
    setSchoolId(t.school_id ?? "");
    setReportedBy(t.reported_by ?? "");
    setAccountable(t.accountable ?? "");
    setResponsible(t.responsible ?? "");
    setReportDate(t.report_date);
    setDeadline(t.deadline ?? "");
    setResolvedDate(t.resolved_date ?? "");
    setNextSteps(t.next_steps ?? "");
    setNotes(t.notes ?? "");
    setCost(t.cost != null ? String(t.cost) : "");
    setLogAsExpense(false);
    clearFlash();
  }

  async function deleteIssueRow(id: string) {
    if (!confirm("Delete this issue?")) return;
    const res = await fetch(`/api/facilities/issues/${id}`, { method: "DELETE" });
    if (res.ok) {
      setIssues((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
    }
  }

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    clearFlash();
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/facilities/issues/${editingId}` : "/api/facilities/issues",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId: schoolId || undefined,
            description: description.trim(),
            status,
            reportedBy: reportedBy.trim() || undefined,
            accountable: accountable.trim() || undefined,
            responsible: responsible.trim() || undefined,
            reportDate: reportDate || undefined,
            deadline: deadline || undefined,
            resolvedDate: resolvedDate || undefined,
            nextSteps: nextSteps.trim() || undefined,
            notes: notes.trim() || undefined,
            cost: cost.trim() ? Number(cost) : undefined,
            logAsExpense: logAsExpense || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        issue?: FacilitiesIssue;
        error?: string;
        expenseError?: string;
      };
      if (!res.ok || !data.issue) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setIssues((prev) =>
        isEdit
          ? prev.map((t) => (t.id === data.issue!.id ? data.issue! : t))
          : [data.issue!, ...prev],
      );
      setOkMsg(
        data.expenseError
          ? `Issue ${isEdit ? "updated" : "saved"} — but expense not logged: ${data.expenseError}`
          : `Issue ${isEdit ? "updated" : "saved"}${data.issue.expense_id ? " and logged as an expense" : ""}`,
      );
      resetForm();
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(
    () =>
      issues.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (campusFilter === "all" || t.school_id === campusFilter),
      ),
    [issues, statusFilter, campusFilter],
  );

  const schoolName = (id: string | null) =>
    schools.find((s) => s.id === id)?.name ?? (id ? "Campus" : "Usa River");

  return (
    <div className="mt-6">
      {loadError ? (
        <p className="mb-4 rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm text-ink">
          Could not load issues: <span className="font-semibold">{loadError}</span>. Run{" "}
          <code className="text-xs">APPLY_FACILITIES_ACCESS.sql</code> if you are not admin.
        </p>
      ) : null}
      {error ? <p className="mb-4 text-sm font-semibold text-danger">{error}</p> : null}
      {okMsg ? <p className="mb-4 text-sm font-semibold text-success">{okMsg}</p> : null}

      <div className={showForm ? "grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start" : "grid gap-8"}>
        {showForm ? (
        <form
          onSubmit={submitIssue}
          className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {editingId ? "Edit issue" : "New issue"}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={2}
                placeholder="e.g. Unblock chambers girls dormitory"
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IssueStatus)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
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
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Reported by</span>
              <input
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Accountable</span>
                <input
                  value={accountable}
                  onChange={(e) => setAccountable(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Responsible</span>
                <input
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Reported</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Deadline</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Resolved</span>
                <input
                  type="date"
                  value={resolvedDate}
                  onChange={(e) => setResolvedDate(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Agreed next steps</span>
              <textarea
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                rows={2}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-ink">Cost (TZS)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
              />
            </label>
            {editingId && issues.find((t) => t.id === editingId)?.expense_id ? (
              <p className="text-xs font-semibold text-success">
                Already logged as an expense on the Ledger.
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={logAsExpense}
                  onChange={(e) => setLogAsExpense(e.target.checked)}
                />
                <span className="text-ink">Log as R&amp;M expense (needs a campus and cost)</span>
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Saving…" : editingId ? "Update issue" : "Save issue"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
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
              Issues
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
                className="rounded-[var(--radius-sm)] bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
              >
                {showForm ? "Close" : "+ New issue"}
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as IssueStatus | "all")}
                className="rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {issues.length === 0
                ? "No R&M issues yet — log one below."
                : "No issues match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
              <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                <thead className="bg-light-blue-30 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Description of issue</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Reported by</th>
                    <th className="px-3 py-2 font-semibold">Report date</th>
                    <th className="px-3 py-2 font-semibold">Deadline</th>
                    <th className="px-3 py-2 font-semibold">Accountable</th>
                    <th className="px-3 py-2 font-semibold">Responsible</th>
                    <th className="px-3 py-2 font-semibold">Resolved</th>
                    <th className="px-3 py-2 font-semibold">Days</th>
                    <th className="px-3 py-2 font-semibold">Campus</th>
                    <th className="px-3 py-2 font-semibold">Cost</th>
                    <th className="px-3 py-2 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, idx) => {
                    const days = daysBetween(t.report_date, t.resolved_date);
                    return (
                      <tr key={t.id} className="border-t border-card-border align-top">
                        <td className="px-3 py-2 tabular-nums text-ink-faint">{idx + 1}</td>
                        <td className="max-w-[16rem] px-3 py-2 font-semibold text-ink">
                          {t.description}
                          {t.next_steps ? (
                            <p className="mt-1 text-xs font-normal text-ink-faint">
                              Next: {t.next_steps}
                            </p>
                          ) : null}
                          {t.notes ? (
                            <p className="mt-1 text-xs font-normal text-ink-faint">
                              Notes: {t.notes}
                            </p>
                          ) : null}
                          <LastEditedBy row={t} labels={profileLabels} />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[t.status]}`}
                          >
                            {STATUS_LABEL[t.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink-muted">{t.reported_by ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">{t.report_date}</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">
                          {t.deadline ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-ink-muted">{t.accountable ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-muted">{t.responsible ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">
                          {t.resolved_date ?? "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">
                          {days === null ? "—" : days}
                        </td>
                        <td className="px-3 py-2 text-ink-muted">{schoolName(t.school_id)}</td>
                        <td className="px-3 py-2 tabular-nums text-ink-muted">
                          {t.cost != null ? t.cost.toLocaleString() : "—"}
                          {t.expense_id ? (
                            <span className="ml-1.5 rounded-full bg-success-15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                              logged
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="mr-2 text-xs font-semibold text-electric-blue hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIssueRow(t.id)}
                            className="text-xs font-semibold text-danger hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
