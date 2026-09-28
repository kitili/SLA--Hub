"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TASK_PRIORITY_TONE } from "@/lib/system-status";
import type { SystemPermissions } from "@/lib/system-permissions";
import type { Person, ProjectPhase, ProjectSprint, TaskDetail, TaskPriority, TaskRecurrence, TaskStatus } from "@/lib/task-types";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_RECURRENCES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/task-types";

export function TaskDrawer({
  systemId,
  taskId,
  staff,
  siblingTasks,
  permissions,
  onClose,
  onChanged,
  onDeleted,
}: {
  systemId: string;
  taskId: string;
  staff: Person[];
  siblingTasks: { id: string; title: string; taskNumber: number }[];
  permissions: SystemPermissions;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});
  const [tagName, setTagName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);

  async function load() {
    const res = await fetch(`/api/systems/${systemId}/tasks/${taskId}`);
    if (!res.ok) {
      setError("Could not load this task.");
      return;
    }
    const data = await res.json();
    setTask(data.task);
    const [phaseRes, sprintRes] = await Promise.all([
      fetch(`/api/systems/${systemId}/phases`),
      fetch(`/api/systems/${systemId}/sprints`),
    ]);
    if (phaseRes.ok) setPhases((await phaseRes.json()).phases ?? []);
    if (sprintRes.ok) setSprints((await sprintRes.json()).sprints ?? []);
  }

  useEffect(() => {
    void load();
  }, [taskId]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/systems/${systemId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save.");
      return;
    }
    await load();
    onChanged();
  }

  async function extras(body: Record<string, unknown>) {
    const res = await fetch(`/api/systems/${systemId}/tasks/${taskId}/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update.");
      return;
    }
    const data = await res.json();
    setTask(data.task);
    onChanged();
  }

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
        <div className="h-full w-full max-w-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-black/50">{error ?? "Loading…"}</p>
        </div>
      </div>
    );
  }

  const canEdit = permissions.canEditTask;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div>
            <div className="text-xs text-black/40">Task #{task.taskNumber}</div>
            {canEdit ? (
              <Input
                className="mt-1 border-0 px-0 text-lg font-medium shadow-none focus:ring-0"
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                onBlur={() => void patch({ title: task.title })}
              />
            ) : (
              <h2 className="mt-1 text-lg font-medium text-navy">{task.title}</h2>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select
                value={task.status}
                disabled={!canEdit}
                onChange={(e) => void patch({ status: e.target.value as TaskStatus })}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Phase</Label>
              <Select
                value={task.phaseId ?? ""}
                disabled={!canEdit}
                onChange={(e) => void patch({ phaseId: e.target.value || null })}
              >
                <option value="">None</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Sprint</Label>
              <Select
                value={task.sprintId ?? ""}
                disabled={!canEdit}
                onChange={(e) => void patch({ sprintId: e.target.value || null })}
              >
                <option value="">Backlog</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    Sprint {sprint.number}: {sprint.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={task.priority}
                disabled={!canEdit}
                onChange={(e) => void patch({ priority: e.target.value as TaskPriority })}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="date"
                value={task.startDate ?? ""}
                disabled={!canEdit}
                onChange={(e) => void patch({ startDate: e.target.value || null })}
              />
            </div>
            <div>
              <Label>Due</Label>
              <Input
                type="date"
                value={task.dueDate ?? ""}
                disabled={!canEdit}
                onChange={(e) => void patch({ dueDate: e.target.value || null })}
              />
            </div>
            <div>
              <Label>Estimate (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={task.timeEstimateMinutes ?? ""}
                disabled={!canEdit}
                onChange={(e) =>
                  void patch({ timeEstimateMinutes: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div>
              <Label>Points</Label>
              <Input
                type="number"
                min={0}
                value={task.points ?? ""}
                disabled={!canEdit}
                onChange={(e) => void patch({ points: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>Repeat</Label>
              <Select
                value={task.recurrence}
                disabled={!canEdit}
                onChange={(e) => void patch({ recurrence: e.target.value as TaskRecurrence })}
              >
                {TASK_RECURRENCES.map((value) => (
                  <option key={value} value={value}>
                    {value === "none" ? "Does not repeat" : value}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Time tracked</Label>
              <p className="pt-2 text-sm text-black/60">{task.timeSpentMinutes} minutes</p>
            </div>
          </div>

          <div>
            <Label>Assignees</Label>
            <div className="mt-1 flex flex-col gap-1 rounded-md border border-black/10 p-2">
              {staff.map((person) => {
                const checked = task.assignees.some((a) => a.id === person.id);
                return (
                  <label key={person.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!permissions.canAssignTask}
                      onChange={() => {
                        const next = checked
                          ? task.assignees.filter((a) => a.id !== person.id).map((a) => a.id)
                          : [...task.assignees.map((a) => a.id), person.id];
                        void extras({ op: "set_assignees", userIds: next });
                      }}
                    />
                    {person.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Watchers</Label>
            <div className="mt-1 flex flex-col gap-1 rounded-md border border-black/10 p-2">
              {staff.map((person) => {
                const checked = task.watchers.some((a) => a.id === person.id);
                return (
                  <label key={person.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? task.watchers.filter((a) => a.id !== person.id).map((a) => a.id)
                          : [...task.watchers.map((a) => a.id), person.id];
                        void extras({ op: "set_watchers", userIds: next });
                      }}
                    />
                    {person.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={task.description ?? ""}
              disabled={!canEdit}
              onChange={(e) => setTask({ ...task, description: e.target.value })}
              onBlur={() => void patch({ description: task.description || null })}
              placeholder="Write the brief, acceptance criteria, links…"
            />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void extras({ op: "remove_tag", tagId: tag.id })}
                  className="rounded px-2 py-0.5 text-xs text-white"
                  style={{ background: tag.color }}
                >
                  {tag.name} ×
                </button>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="New tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagName.trim()) {
                      void extras({ op: "add_tag", name: tagName.trim() }).then(() => setTagName(""));
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={!tagName.trim()}
                  onClick={() => void extras({ op: "add_tag", name: tagName.trim() }).then(() => setTagName(""))}
                >
                  Add
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Subtasks</Label>
            <div className="mt-1 flex flex-col gap-1">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-md bg-gray-light/70 px-3 py-2 text-sm">
                  <span>
                    #{sub.taskNumber} {sub.title}
                  </span>
                  <Badge tone={TASK_PRIORITY_TONE[sub.priority]}>{TASK_STATUS_LABELS[sub.status]}</Badge>
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask"
                />
                <Button
                  disabled={!subtaskTitle.trim()}
                  onClick={async () => {
                    await fetch(`/api/systems/${systemId}/tasks`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: subtaskTitle.trim(), parentTaskId: task.id, status: task.status }),
                    });
                    setSubtaskTitle("");
                    await load();
                    onChanged();
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Checklists</Label>
            {task.checklists.map((list) => (
              <div key={list.id} className="mt-2 rounded-md border border-black/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{list.title}</span>
                  {canEdit && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => void extras({ op: "delete_checklist", checklistId: list.id })}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {list.items.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!canEdit}
                      onChange={() =>
                        void extras({ op: "toggle_checklist_item", itemId: item.id, done: !item.done })
                      }
                    />
                    <span className={item.done ? "text-black/40 line-through" : ""}>{item.title}</span>
                  </label>
                ))}
                {canEdit && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={itemDraft[list.id] ?? ""}
                      onChange={(e) => setItemDraft((prev) => ({ ...prev, [list.id]: e.target.value }))}
                      placeholder="Checklist item"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const title = itemDraft[list.id]?.trim();
                        if (!title) return;
                        void extras({ op: "add_checklist_item", checklistId: list.id, title }).then(() =>
                          setItemDraft((prev) => ({ ...prev, [list.id]: "" })),
                        );
                      }}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  placeholder="Checklist name"
                />
                <Button
                  disabled={!checklistTitle.trim()}
                  onClick={() =>
                    void extras({ op: "add_checklist", title: checklistTitle.trim() }).then(() => setChecklistTitle(""))
                  }
                >
                  New list
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Blocked by</Label>
            <div className="mt-1 flex flex-col gap-1 text-sm">
              {task.blockedBy.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between">
                  <span>
                    #{dep.taskNumber} {dep.title}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => void extras({ op: "remove_dependency", dependsOnTaskId: dep.id })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <Select
                className="mt-2"
                value=""
                onChange={(e) => {
                  if (e.target.value) void extras({ op: "add_dependency", dependsOnTaskId: e.target.value });
                }}
              >
                <option value="">Add a blocking task…</option>
                {siblingTasks
                  .filter((t) => t.id !== task.id && !task.blockedBy.some((d) => d.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.taskNumber} {t.title}
                    </option>
                  ))}
              </Select>
            )}
          </div>

          <div>
            <Label>Attachments</Label>
            <div className="mt-1 flex flex-col gap-1">
              {task.attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between text-sm">
                  <a href={file.url} target="_blank" rel="noreferrer" className="text-navy underline">
                    {file.filename}
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => void extras({ op: "delete_attachment", attachmentId: file.id })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <input
                className="mt-2 text-sm"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.set("file", file);
                  await fetch(`/api/systems/${systemId}/tasks/${taskId}/attachments`, { method: "POST", body: form });
                  e.target.value = "";
                  await load();
                  onChanged();
                }}
              />
            )}
          </div>

          <div>
            <Label>Log time</Label>
            <div className="mt-1 flex gap-2">
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Minutes"
              />
              <Button
                disabled={!minutes}
                onClick={() =>
                  void extras({ op: "log_time", minutes: Number(minutes) }).then(() => setMinutes(""))
                }
              >
                Log
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-black/50">
              {task.timeEntries.map((entry) => (
                <div key={entry.id} className="flex justify-between">
                  <span>
                    {entry.minutes}m {entry.user?.name ? `· ${entry.user.name}` : ""} {entry.note ? `· ${entry.note}` : ""}
                  </span>
                  {canEdit && (
                    <button type="button" onClick={() => void extras({ op: "delete_time", entryId: entry.id })}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Comments</Label>
            <div className="mt-2 flex flex-col gap-2">
              {task.comments.map((row) => (
                <div key={row.id} className="rounded-md bg-gray-light/70 px-3 py-2 text-sm">
                  <div className="text-xs text-black/40">
                    {row.author?.name ?? "Someone"} · {new Date(row.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{row.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment"
              />
              <Button
                disabled={!comment.trim()}
                onClick={() => void extras({ op: "add_comment", body: comment.trim() }).then(() => setComment(""))}
              >
                Send
              </Button>
            </div>
          </div>

          <div>
            <Label>Activity</Label>
            <div className="mt-2 flex flex-col gap-1 text-xs text-black/50">
              {task.activity.map((row) => (
                <div key={row.id}>
                  {row.actor?.name ?? "System"} {row.verb}
                  {row.detail ? ` · ${row.detail}` : ""} · {new Date(row.createdAt).toLocaleString()}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4">
            {canEdit && (
              <Button variant="ghost" disabled={saving} onClick={() => void patch({ archived: !task.archived })}>
                {task.archived ? "Restore" : "Archive"}
              </Button>
            )}
            {permissions.canDeleteTask && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm(`Delete "${task.title}"?`)) return;
                  await fetch(`/api/systems/${systemId}/tasks/${taskId}`, { method: "DELETE" });
                  onDeleted();
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
