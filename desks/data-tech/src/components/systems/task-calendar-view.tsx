"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_COLORS, type BoardTask } from "@/lib/task-types";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInGrid(month: Date) {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function key(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TaskCalendarView({
  tasks,
  onOpen,
}: {
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const days = useMemo(() => daysInGrid(cursor), [cursor]);
  const byDue = useMemo(() => {
    const map = new Map<string, BoardTask[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [tasks]);

  return (
    <div className="rounded-lg border border-black/10 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          Previous
        </Button>
        <h3 className="text-sm font-medium text-navy">
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <Button
          variant="ghost"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          Next
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-black/10 text-center text-[11px] font-medium uppercase text-black/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-white py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-black/10">
        {days.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const items = byDue.get(key(day)) ?? [];
          return (
            <div key={day.toISOString()} className={`min-h-24 bg-white p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <div className="mb-1 text-xs text-black/50">{day.getDate()}</div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpen(task)}
                    className="truncate rounded px-1 py-0.5 text-left text-[11px] text-white"
                    style={{ background: TASK_STATUS_COLORS[task.status] }}
                  >
                    {task.title}
                  </button>
                ))}
                {items.length > 3 && <span className="text-[10px] text-black/40">+{items.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
