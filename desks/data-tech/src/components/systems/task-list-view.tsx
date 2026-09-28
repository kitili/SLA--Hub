"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TASK_PRIORITY_TONE } from "@/lib/system-status";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  type BoardTask,
  type TaskStatus,
} from "@/lib/task-types";
import type { SystemPermissions } from "@/lib/system-permissions";

function TaskRow({
  task,
  depth,
  onOpen,
  children,
}: {
  task: BoardTask;
  depth: number;
  onOpen: (task: BoardTask) => void;
  children?: React.ReactNode;
}) {
  const isOverdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();
  return (
    <>
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="grid w-full grid-cols-[auto_1fr_7rem_8rem_7rem_6rem_8rem] items-center gap-3 border-b border-black/5 px-3 py-2 text-left text-sm hover:bg-[#7B68EE]/5"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <span className="w-10 text-xs text-black/35">#{task.taskNumber}</span>
        <span className="truncate font-medium text-black/85">
          {task.title}
          {task.subtaskCount > 0 && (
            <span className="ml-2 text-xs font-normal text-black/40">
              {task.subtaskDone}/{task.subtaskCount}
            </span>
          )}
        </span>
        <span className="truncate text-xs text-black/55">
          {task.assignees.map((a) => a.name).join(", ") || "—"}
        </span>
        <span className={`text-xs ${isOverdue ? "text-red-600" : "text-black/55"}`}>
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
        </span>
        <span className="truncate text-xs text-black/45">{task.sprintName ?? "Backlog"}</span>
        <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag.id} className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>
      </button>
      {children}
    </>
  );
}

export function TaskListView({
  tasks,
  onOpen,
  onAdd,
  permissions,
}: {
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
  onAdd: (title: string, status: TaskStatus) => Promise<void>;
  permissions: SystemPermissions;
}) {
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [title, setTitle] = useState("");
  const parents = tasks.filter((t) => !t.parentTaskId);

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
      <div className="hidden grid-cols-[auto_1fr_8rem_7rem_6rem_8rem] gap-3 border-b border-black/10 bg-gray-light/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-black/40 md:grid">
        <span className="w-10">ID</span>
        <span>Task</span>
        <span>Assignees</span>
        <span>Due</span>
        <span>Priority</span>
        <span>Tags</span>
      </div>
      {TASK_STATUSES.map((status) => {
        const group = parents.filter((t) => t.status === status);
        return (
          <div key={status}>
            <div className="flex items-center gap-2 bg-gray-light/40 px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS_COLORS[status] }} />
              <span className="text-xs font-medium text-black/60">{TASK_STATUS_LABELS[status]}</span>
              <span className="text-xs text-black/35">{group.length}</span>
            </div>
            {group.map((task) => (
              <TaskRow key={task.id} task={task} depth={0} onOpen={onOpen}>
                {tasks
                  .filter((child) => child.parentTaskId === task.id)
                  .map((child) => (
                    <TaskRow key={child.id} task={child} depth={1} onOpen={onOpen} />
                  ))}
              </TaskRow>
            ))}
            {permissions.canCreateTask &&
              (addingTo === status ? (
                <div className="flex gap-2 px-3 py-2">
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void onAdd(title.trim(), status).then(() => {
                          setTitle("");
                          setAddingTo(null);
                        });
                      }
                      if (e.key === "Escape") setAddingTo(null);
                    }}
                    placeholder="Task name"
                  />
                  <Button
                    className="shrink-0"
                    onClick={() => {
                      if (!title.trim()) return;
                      void onAdd(title.trim(), status).then(() => {
                        setTitle("");
                        setAddingTo(null);
                      });
                    }}
                  >
                    Add
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTo(status)}
                  className="w-full px-3 py-2 text-left text-xs text-black/40 hover:bg-black/5"
                >
                  + Add task
                </button>
              ))}
          </div>
        );
      })}
      {parents.length === 0 && (
        <p className="px-3 py-10 text-center text-sm text-black/40">No tasks yet — add one under a status.</p>
      )}
    </div>
  );
}
