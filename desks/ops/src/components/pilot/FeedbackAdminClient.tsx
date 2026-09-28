"use client";

import { useMemo, useState } from "react";
import type { FeedbackStatus, PilotFeedback } from "@/lib/db/pilot-feedback";
import { DEPARTMENT_LABEL } from "@/lib/pilot-feedback/department";

const STATUSES: FeedbackStatus[] = ["open", "in_progress", "done"];

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_TONE: Record<FeedbackStatus, string> = {
  open: "bg-danger-15 text-danger",
  in_progress: "bg-gold-15 text-ink-muted",
  done: "bg-success-15 text-success",
};

type Props = {
  initialFeedback: PilotFeedback[];
  resolverLabels: Record<string, string>;
};

export function FeedbackAdminClient({ initialFeedback, resolverLabels }: Props) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);

  const openCount = useMemo(
    () => feedback.filter((f) => f.status !== "done").length,
    [feedback],
  );

  const departments = useMemo(
    () => [...new Set(feedback.map((f) => f.department))].sort(),
    [feedback],
  );

  const filtered = useMemo(
    () =>
      feedback.filter(
        (f) =>
          (departmentFilter === "all" || f.department === departmentFilter) &&
          (statusFilter === "all" || f.status === statusFilter),
      ),
    [feedback, departmentFilter, statusFilter],
  );

  async function updateStatus(id: string, status: FeedbackStatus) {
    setError(null);
    const res = await fetch(`/api/pilot-feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res.json()) as { feedback?: PilotFeedback; error?: string };
    if (!res.ok || !data.feedback) {
      setError(data.error ?? "Update failed");
      return;
    }
    setFeedback((prev) => prev.map((f) => (f.id === id ? data.feedback! : f)));
  }

  async function markOpenDone() {
    setError(null);
    setClosingAll(true);
    try {
      const res = await fetch("/api/pilot-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", scope: "open" }),
      });
      const data = (await res.json()) as { feedback?: PilotFeedback[]; error?: string };
      if (!res.ok || !data.feedback) {
        setError(data.error ?? "Could not mark feedback done");
        return;
      }
      const byId = new Map(data.feedback.map((f) => [f.id, f]));
      setFeedback((prev) => prev.map((f) => byId.get(f.id) ?? f));
    } finally {
      setClosingAll(false);
    }
  }

  return (
    <div className="mt-6">
      {error ? <p className="mb-4 text-sm font-semibold text-danger">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm text-ink"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {DEPARTMENT_LABEL[d] ?? d}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
          className="rounded-(--radius-sm) border border-card-border px-3 py-1.5 text-sm text-ink"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {openCount > 0 ? (
          <button
            type="button"
            onClick={() => void markOpenDone()}
            disabled={closingAll}
            className="rounded-(--radius-sm) bg-electric-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {closingAll ? "Marking…" : `Mark ${openCount} shipped as done`}
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {feedback.length === 0 ? "No feedback yet." : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((f) => (
            <li
              key={f.id}
              className="rounded-(--radius) border border-card-border bg-card p-4 shadow-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-light-blue-30 px-2 py-0.5 text-xs font-bold text-electric-blue">
                      {DEPARTMENT_LABEL[f.department] ?? f.department}
                    </span>
                    <span className="text-xs text-ink-faint">{f.page_path}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{f.message}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {f.submitted_by_label} · {new Date(f.created_at).toLocaleString()}
                    {f.status === "done" && f.resolved_by
                      ? ` · resolved by ${resolverLabels[f.resolved_by] ?? "someone"}`
                      : ""}
                  </p>
                </div>
                <select
                  value={f.status}
                  onChange={(e) => updateStatus(f.id, e.target.value as FeedbackStatus)}
                  className={`shrink-0 rounded-full border-0 px-3 py-1.5 text-xs font-bold ${STATUS_TONE[f.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
