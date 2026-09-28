"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { PRIORITY_LABELS, TYPE_ICONS } from "@/lib/board/columns";
import { StatusBadge } from "@/components/status-badge";
import type { BoardUser } from "@/lib/board/types";

type TaskDetail = {
  id: string;
  taskKey: string | null;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  labels: string[];
  storyPoints: number | null;
  dueDate: string | null;
  blockerNote: string | null;
  assignee: BoardUser | null;
  project: { id: string; name: string; key: string } | null;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: BoardUser | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
    user: BoardUser | null;
  }>;
};

type TaskDetailPanelProps = {
  taskId: string;
  users: BoardUser[];
  onClose: () => void;
  onUpdated: () => void;
};

export function TaskDetailPanel({ taskId, users, onClose, onUpdated }: TaskDetailPanelProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    const res = await fetch(`/api/board/tasks/${taskId}`);
    if (res.ok) {
      setTask((await res.json()) as TaskDetail);
    }
    setLoading(false);
  }

  async function patchTask(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setTask((await res.json()) as TaskDetail);
      onUpdated();
    }
    setSaving(false);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;

    const res = await fetch(`/api/board/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment.trim() }),
    });

    if (res.ok) {
      setComment("");
      await loadTask();
      onUpdated();
    }
  }

  if (loading || !task) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-zinc-200 bg-white p-6 shadow-2xl">
        <p className="text-sm text-zinc-500">Loading issue…</p>
      </div>
    );
  }

  const priority = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.MEDIUM;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <p className="text-sm font-medium text-blue-600">{task.taskKey}</p>
          <p className="text-xs text-zinc-500">{task.project?.name}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-start gap-2">
          <span className="text-xl">{TYPE_ICONS[task.type] ?? "✓"}</span>
          <input
            defaultValue={task.title}
            onBlur={(e) => {
              if (e.target.value !== task.title) void patchTask({ title: e.target.value });
            }}
            className="w-full text-xl font-semibold text-zinc-900 outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={task.status} />
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priority.className}`}>
            {priority.label}
          </span>
          {task.labels.map((label) => (
            <span key={label} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <label>
            <span className="font-medium text-zinc-500">Status</span>
            <select
              value={task.status}
              disabled={saving}
              onChange={(e) => void patchTask({ status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            >
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>

          <label>
            <span className="font-medium text-zinc-500">Assignee</span>
            <select
              value={task.assignee?.id ?? ""}
              disabled={saving}
              onChange={(e) => void patchTask({ assigneeId: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.phone}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="font-medium text-zinc-500">Priority</span>
            <select
              value={task.priority}
              disabled={saving}
              onChange={(e) => void patchTask({ priority: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            >
              <option value="LOWEST">Lowest</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="HIGHEST">Highest</option>
            </select>
          </label>

          <label>
            <span className="font-medium text-zinc-500">Story points</span>
            <input
              type="number"
              min={0}
              defaultValue={task.storyPoints ?? ""}
              onBlur={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                if (val !== task.storyPoints) void patchTask({ storyPoints: val });
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-zinc-500">Description</span>
          <textarea
            defaultValue={task.description ?? ""}
            rows={4}
            onBlur={(e) => {
              const val = e.target.value || null;
              if (val !== task.description) void patchTask({ description: val });
            }}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Add a description…"
          />
        </label>

        {task.dueDate ? (
          <p className="mt-4 text-sm text-zinc-500">Due {format(new Date(task.dueDate), "PPP")}</p>
        ) : null}

        <section className="mt-8">
          <h4 className="font-semibold">Comments</h4>
          <form onSubmit={addComment} className="mt-3 flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Post
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {task.comments.map((c) => (
              <article key={c.id} className="rounded-lg bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">
                  {c.user?.name ?? c.user?.phone ?? "System"} ·{" "}
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </p>
                <p className="mt-1 text-sm text-zinc-800">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h4 className="font-semibold">Activity</h4>
          <div className="mt-3 space-y-2">
            {task.activities.map((a) => (
              <p key={a.id} className="text-xs text-zinc-500">
                {a.type.replaceAll("_", " ").toLowerCase()}
                {a.fromStatus && a.toStatus ? `: ${a.fromStatus} → ${a.toStatus}` : ""}
                {a.message ? ` — ${a.message}` : ""}
                {" · "}
                {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
