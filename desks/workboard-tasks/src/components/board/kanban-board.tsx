"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { canMoveTask, cardOwnerId } from "@/lib/board/access";
import { BOARD_COLUMNS, PRIORITY_LABELS, columnForStatus } from "@/lib/board/columns";
import type { BoardTask, BoardUser } from "@/lib/board/types";
import { BoardColumn } from "@/components/board/board-column";

type KanbanBoardProps = {
  initialTasks: BoardTask[];
  users: BoardUser[];
  currentUserId: string | null;
  mine?: boolean;
};

const collisionDetection: CollisionDetection = (args) => {
  const pointed = pointerWithin(args);
  if (pointed.length > 0) return pointed;
  return rectIntersection(args);
};

function groupByStatus(tasks: BoardTask[]): Record<string, BoardTask[]> {
  const grouped: Record<string, BoardTask[]> = {};
  for (const col of BOARD_COLUMNS) grouped[col.id] = [];
  for (const task of tasks) {
    const column = columnForStatus(task.status);
    grouped[column].push(task);
  }
  return grouped;
}

export function KanbanBoard({ initialTasks, users, currentUserId, mine = false }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState(mine && currentUserId ? currentUserId : "all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");

  const visible = useMemo(
    () =>
      personFilter === "all"
        ? tasks
        : tasks.filter((task) => (task.assignee?.id ?? "unassigned") === personFilter),
    [tasks, personFilter],
  );
  const columns = useMemo(() => groupByStatus(visible), [visible]);
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === String(event.active.id));
    if (!task || !canMoveTask(task, currentUserId)) return;
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canMoveTask(task, currentUserId)) return;

    const overData = over.data.current as { type?: string; status?: string } | undefined;
    let targetStatus: string = columnForStatus(task.status);
    if (overData?.type === "column" || overData?.type === "task") {
      targetStatus = String(overData.status);
    } else if (String(over.id).startsWith("column-")) {
      targetStatus = String(over.id).replace("column-", "");
    }

    if (targetStatus === columnForStatus(task.status)) return;

    setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, status: targetStatus } : item)));
    if (targetStatus !== "COMPLETED") {
      setOpenGroups((prev) => ({ ...prev, [`${targetStatus}:${task.assignee?.id ?? "unassigned"}`]: true }));
    }

    const res = await fetch(`/api/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((item) => (item.id === taskId ? task : item)));
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setNotice(data?.error ?? "That card stayed where it was.");
      return;
    }
    if (targetStatus === "COMPLETED") {
      setTasks((prev) => prev.filter((item) => item.id !== taskId));
      setNotice("Marked Done. It is in 1–5 history and off the board.");
    }
  }

  async function changeTask(
    taskId: string,
    patch: { priority?: string | null; shareWith?: string; handoverTo?: string },
  ) {
    setNotice("");
    const personId = patch.handoverTo ?? patch.shareWith;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const assignee = personId ? (users.find((user) => user.id === personId) ?? task.assignee) : task.assignee;
        return {
          ...task,
          priority: patch.priority === undefined ? task.priority : patch.priority,
          assignee,
          sharedWithIds: patch.handoverTo
            ? []
            : patch.shareWith
              ? Array.from(new Set([...task.sharedWithIds, patch.shareWith]))
              : task.sharedWithIds,
          moveOwnerId: patch.handoverTo ?? task.moveOwnerId ?? cardOwnerId(task),
        };
      }),
    );

    const res = await fetch(`/api/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setTasks(initialTasks);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setNotice(data?.error ?? "That change was not saved.");
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            {personFilter !== "all" && personFilter === currentUserId ? "My board" : "Silverleaf Tasks"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {personFilter !== "all" && personFilter === currentUserId
              ? "Only your cards. In progress stays here. Drag a card to Done and it leaves the board, marked Done in your 1–5 history."
              : "Every person’s open cards are here. In progress stays on the board. Done leaves the board and is marked Done in 1–5 history."}
          </p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-zinc-500">Show</span>
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="all">Everyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.username ?? user.phone}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? <p className="mb-4 text-sm text-[#002368]">{notice}</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <div className="flex gap-4 overflow-x-auto pb-6">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={columns[column.id] ?? []}
              users={users}
              forceOpen={false}
              openGroups={openGroups}
              onToggleGroup={(key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))}
              currentUserId={currentUserId}
              onChangeTask={(id, patch) => void changeTask(id, patch)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
              <p className="text-sm font-semibold">{activeTask.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {PRIORITY_LABELS[activeTask.priority ?? ""]?.label ?? "No priority"}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
