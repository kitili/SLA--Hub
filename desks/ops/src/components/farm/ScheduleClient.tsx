"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FarmCrudActions } from "@/components/farm/FarmCrudActions";
import type {
  ActivityStatus,
  ActivityType,
  FarmActivity,
  FarmCropPlanting,
  FarmPlot,
} from "@/lib/db/farm";

const ACTIVITY_TYPES: ActivityType[] = [
  "prep",
  "plant",
  "weed",
  "inspect",
  "fertilize",
  "irrigate",
  "harvest",
  "other",
];

const STATUSES: ActivityStatus[] = [
  "pending",
  "in_progress",
  "done",
  "skipped",
];

type Props = {
  plots: FarmPlot[];
  plantings: FarmCropPlanting[];
  initialActivities: FarmActivity[];
};

function sortByDueOn(activities: FarmActivity[]): FarmActivity[] {
  return [...activities].sort((a, b) => {
    if (!a.due_on && !b.due_on) return 0;
    if (!a.due_on) return 1;
    if (!b.due_on) return -1;
    return a.due_on.localeCompare(b.due_on);
  });
}

function isOverdue(activity: FarmActivity, today: string): boolean {
  return (
    !!activity.due_on &&
    activity.due_on < today &&
    (activity.status === "pending" || activity.status === "in_progress")
  );
}

export function ScheduleClient({ plots, plantings, initialActivities }: Props) {
  const router = useRouter();
  const [activities, setActivities] = useState(sortByDueOn(initialActivities));
  const [plotId, setPlotId] = useState("");
  const [plantingId, setPlantingId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("prep");
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function resetForm() {
    setEditingId(null);
    setPlotId("");
    setPlantingId("");
    setActivityType("prep");
    setTitle("");
    setDueOn("");
    setAssignee("");
    setNotes("");
  }

  function startEdit(a: FarmActivity) {
    setEditingId(a.id);
    setPlotId(a.plot_id ?? "");
    setPlantingId(a.planting_id ?? "");
    setActivityType(a.activity_type);
    setTitle(a.title);
    setDueOn(a.due_on ?? "");
    setAssignee(a.assignee ?? "");
    setNotes(a.notes ?? "");
    setError(null);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this activity?")) return;
    const res = await fetch(`/api/farm/activities/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setActivities((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) resetForm();
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/farm/activities/${editingId}` : "/api/farm/activities",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  plotId: plotId || null,
                  plantingId: plantingId || null,
                  activityType,
                  title: title.trim(),
                  dueOn: dueOn || null,
                  assignee: assignee.trim() || null,
                  notes: notes.trim() || null,
                }
              : {
                  plotId: plotId || undefined,
                  plantingId: plantingId || undefined,
                  activityType,
                  title: title.trim(),
                  dueOn: dueOn || undefined,
                  assignee: assignee.trim() || undefined,
                  notes: notes.trim() || undefined,
                },
          ),
        },
      );
      const data = (await res.json()) as {
        activity?: FarmActivity;
        error?: string;
      };
      if (!res.ok || !data.activity) {
        setError(data.error ?? "Failed to save activity");
        return;
      }
      setActivities((prev) =>
        isEdit
          ? sortByDueOn(prev.map((a) => (a.id === data.activity!.id ? data.activity! : a)))
          : sortByDueOn([data.activity!, ...prev]),
      );
      resetForm();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: ActivityStatus) {
    setUpdatingId(id);
    setError(null);
    const previous = activities;
    setActivities((prev) =>
      sortByDueOn(
        prev.map((a) => (a.id === id ? { ...a, status } : a)),
      ),
    );
    try {
      const res = await fetch(`/api/farm/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as {
        activity?: FarmActivity;
        error?: string;
      };
      if (!res.ok || !data.activity) {
        setActivities(previous);
        setError(data.error ?? "Failed to update activity");
        return;
      }
      setActivities((prev) =>
        sortByDueOn(
          prev.map((a) => (a.id === id ? data.activity! : a)),
        ),
      );
      router.refresh();
    } catch {
      setActivities(previous);
      setError("Network error.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {editingId ? "Edit activity" : "Schedule activity"}
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Plot</span>
            <select
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">Farm-wide</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name ? `· ${p.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Planting</span>
            <select
              value={plantingId}
              onChange={(e) => setPlantingId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              <option value="">None</option>
              {plantings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plot_code ?? p.plot_id} · {p.crop}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Activity type</span>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Weed plot B"
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Due date</span>
            <input
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Assignee</span>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g. Juma"
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
          {saving ? "Saving…" : editingId ? "Update activity" : "Save activity"}
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
          Activities ({activities.length})
        </h2>

        <ul className="mt-4 divide-y divide-card-border rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow)]">
          {activities.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              No activities scheduled yet.
            </li>
          ) : (
            activities.map((a) => {
              const overdue = isOverdue(a, today);
              return (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{a.title}</p>
                        {overdue ? (
                          <span className="rounded-full bg-danger-15 px-2 py-0.5 text-[11px] font-bold text-danger">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink-muted">
                        {a.activity_type} · {a.plot_code ?? "Farm-wide"}
                        {a.due_on ? ` · due ${a.due_on}` : ""}
                        {a.assignee ? ` · ${a.assignee}` : ""}
                      </p>
                      {a.notes ? (
                        <p className="mt-1 text-xs text-ink-faint">{a.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-semibold text-ink-muted">Status</span>
                        <select
                          value={a.status}
                          disabled={updatingId === a.id}
                          onChange={(e) =>
                            void changeStatus(a.id, e.target.value as ActivityStatus)
                          }
                          className="rounded-[var(--radius-sm)] border border-card-border px-2 py-1 text-ink disabled:opacity-60"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FarmCrudActions
                        onEdit={() => startEdit(a)}
                        onDelete={() => void deleteRow(a.id)}
                      />
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
