"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_TONE } from "@/lib/system-status";
import { canMoveTask, type SystemPermissions } from "@/lib/system-permissions";
import { TASK_PRIORITY_LABELS, type BoardTask } from "@/lib/task-types";

export function TaskCard({
  task,
  onClick,
  permissions,
  currentUserId,
}: {
  task: BoardTask;
  onClick: () => void;
  permissions: SystemPermissions;
  currentUserId: string;
}) {
  const assigneeIds = task.assignees.map((a) => a.id);
  const movable = canMoveTask(
    permissions,
    { assigneeId: task.assignee?.id ?? null, assigneeIds },
    currentUserId,
  );
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled: !movable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();
  const names = task.assignees.map((a) => a.name).join(", ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`rounded-xl border border-navy/10 bg-white p-3 text-sm shadow-[0_10px_24px_-18px_rgba(0,35,104,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-16px_rgba(0,35,104,0.55)] ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-navy/40">#{task.taskNumber}</div>
      <div className="font-medium text-black/90">{task.title}</div>
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ background: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.sprintName && <Badge tone="info">{task.sprintName}</Badge>}
        {task.phaseName && <span className="text-[11px] text-black/45">{task.phaseName}</span>}
        <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
        {task.dueDate && (
          <Badge tone={isOverdue ? "danger" : "neutral"}>
            {isOverdue ? "Overdue " : "Due "}
            {new Date(task.dueDate).toLocaleDateString()}
          </Badge>
        )}
        {task.subtaskCount > 0 && (
          <span className="text-[11px] text-black/45">
            {task.subtaskDone}/{task.subtaskCount} sub
          </span>
        )}
        {task.checklistTotal > 0 && (
          <span className="text-[11px] text-black/45">
            {task.checklistDone}/{task.checklistTotal} ✓
          </span>
        )}
        {task.commentCount > 0 && <span className="text-[11px] text-black/45">{task.commentCount} 💬</span>}
      </div>
      {(task.completionPercentage > 0 || task.checklistTotal > 0) && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-accent to-gold-accent"
            style={{
              width: `${task.checklistTotal ? Math.round((task.checklistDone / task.checklistTotal) * 100) : task.completionPercentage}%`,
            }}
          />
        </div>
      )}
      {names && <div className="mt-2 text-xs text-black/50">{names}</div>}
    </div>
  );
}
