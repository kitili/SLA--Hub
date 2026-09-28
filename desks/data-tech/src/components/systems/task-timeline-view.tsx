"use client";

import { TASK_PRIORITY_TONE } from "@/lib/system-status";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABELS, TASK_STATUS_COLORS, type BoardTask } from "@/lib/task-types";

function parse(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function TaskTimelineView({
  tasks,
  onOpen,
}: {
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
}) {
  const dated = tasks.filter((t) => t.startDate || t.dueDate);
  if (dated.length === 0) {
    return (
      <p className="rounded-lg border border-black/10 bg-white px-4 py-10 text-center text-sm text-black/40">
        Add start or due dates to see tasks on the timeline.
      </p>
    );
  }

  const starts = dated.map((t) => parse(t.startDate ?? t.dueDate!));
  const ends = dated.map((t) => parse(t.dueDate ?? t.startDate!));
  const min = new Date(Math.min(...starts.map((d) => d.getTime())));
  const max = new Date(Math.max(...ends.map((d) => d.getTime())));
  min.setDate(min.getDate() - 2);
  max.setDate(max.getDate() + 2);
  const range = Math.max(max.getTime() - min.getTime(), 86400000);

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
      <div className="min-w-[720px] p-4">
        {dated.map((task) => {
          const start = parse(task.startDate ?? task.dueDate!);
          const end = parse(task.dueDate ?? task.startDate!);
          const left = ((start.getTime() - min.getTime()) / range) * 100;
          const width = Math.max(((end.getTime() - start.getTime()) / range) * 100, 2);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpen(task)}
              className="mb-3 grid w-full grid-cols-[14rem_1fr] items-center gap-3 text-left"
            >
              <div>
                <div className="truncate text-sm font-medium text-black/80">{task.title}</div>
                <div className="flex items-center gap-2">
                  <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                  <span className="text-[11px] text-black/40">#{task.taskNumber}</span>
                </div>
              </div>
              <div className="relative h-8 rounded bg-gray-light/80">
                <div
                  className="absolute top-1 h-6 rounded-md"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: TASK_STATUS_COLORS[task.status],
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
