"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BoardColumn as ColumnDef } from "@/lib/board/columns";
import type { BoardTask, BoardUser } from "@/lib/board/types";
import { TaskCard } from "@/components/board/task-card";

type BoardColumnProps = {
  column: ColumnDef;
  tasks: BoardTask[];
  users: BoardUser[];
  forceOpen: boolean;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  currentUserId: string | null;
  onChangeTask: (taskId: string, patch: { priority?: string | null; shareWith?: string; handoverTo?: string }) => void;
};

function personKey(task: BoardTask) {
  return task.assignee?.id ?? "unassigned";
}

function personName(task: BoardTask) {
  return task.assignee?.name ?? task.assignee?.username ?? "Unassigned";
}

export function BoardColumn({
  column,
  tasks,
  users,
  forceOpen,
  openGroups,
  onToggleGroup,
  currentUserId,
  onChangeTask,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", status: column.id },
  });

  const groups = new Map<string, BoardTask[]>();
  for (const task of tasks) {
    const key = personKey(task);
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  return (
    <section
      ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col rounded-2xl border ${column.color} ${
        isOver ? "ring-2 ring-[#FFC952]" : ""
      }`}
    >
      <header className="flex items-center justify-between px-3 py-3">
        <h3 className="text-sm font-semibold" style={{ color: "#14233B" }}>
          {column.title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${column.pill}`}>
          {tasks.length}
        </span>
      </header>

      <div className="flex min-h-[180px] flex-1 flex-col gap-2 px-2 pb-3">
        {tasks.length === 0 && column.id === "COMPLETED" ? (
          <p className="px-2 py-3 text-xs leading-5" style={{ color: "#4f555f" }}>
            Drop a finished card here. It leaves this column and shows as Done in 1–5 history.
          </p>
        ) : null}
        {[...groups.entries()].map(([key, groupTasks]) => {
          const storageKey = `${column.id}:${key}`;
          const open = forceOpen || openGroups[storageKey];
          const ids = groupTasks.map((task) => task.id);

          return (
            <div key={storageKey} className="rounded-lg bg-white/80 px-2 py-1">
              <button
                type="button"
                onClick={() => onToggleGroup(storageKey)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-white"
              >
                <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "#14233B" }}>
                  {personName(groupTasks[0])}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "#4f555f" }}>
                  {groupTasks.length} {open ? "▾" : "▸"}
                </span>
              </button>

              {open ? (
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <div className="mt-2 flex flex-col gap-2">
                    {groupTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        columnStatus={column.id}
                        users={users}
                        currentUserId={currentUserId}
                        onChange={onChangeTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
