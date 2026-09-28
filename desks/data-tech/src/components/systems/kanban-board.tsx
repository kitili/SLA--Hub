"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SystemPermissions } from "@/lib/system-permissions";
import { TASK_STATUSES, TASK_STATUS_LABELS, type BoardTask, type TaskStatus, type WipLimits } from "@/lib/task-types";

function Column({
  status,
  tasks,
  onCardClick,
  addingTo,
  newTitle,
  onStartAdd,
  onCancelAdd,
  onChangeNewTitle,
  onSubmitAdd,
  permissions,
  currentUserId,
  wipLimit,
}: {
  status: TaskStatus;
  tasks: BoardTask[];
  onCardClick: (task: BoardTask) => void;
  addingTo: TaskStatus | null;
  newTitle: string;
  onStartAdd: (status: TaskStatus) => void;
  onCancelAdd: () => void;
  onChangeNewTitle: (value: string) => void;
  onSubmitAdd: (status: TaskStatus) => void;
  permissions: SystemPermissions;
  currentUserId: string;
  wipLimit: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border border-navy/10 bg-white/55 p-2 backdrop-blur-sm ${isOver ? "ring-2 ring-gold-accent" : ""} ${wipLimit != null && tasks.length > wipLimit ? "ring-1 ring-red-400" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-black/70">{TASK_STATUS_LABELS[status]}</h3>
        <span className={`text-xs ${wipLimit != null && tasks.length >= wipLimit ? "font-medium text-red-600" : "text-black/40"}`}>
          {tasks.length}
          {wipLimit != null ? `/${wipLimit}` : ""}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
              permissions={permissions}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </SortableContext>

      {permissions.canCreateTask &&
        (addingTo === status ? (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => onChangeNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitAdd(status);
                if (e.key === "Escape") onCancelAdd();
              }}
              placeholder="Task title"
            />
            <div className="flex gap-2">
              <Button className="px-2 py-1 text-xs" onClick={() => onSubmitAdd(status)}>
                Add
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onCancelAdd}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onStartAdd(status)}
            className="mt-2 rounded-md px-2 py-1.5 text-left text-xs text-black/50 hover:bg-black/5"
          >
            + Add task
          </button>
        ))}
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onOpen,
  onAdd,
  onMove,
  showSubtasks,
  permissions,
  currentUserId,
  wipLimits,
}: {
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
  onAdd: (title: string, status: TaskStatus) => Promise<void>;
  onMove: (task: BoardTask, status: TaskStatus, index: number) => Promise<void>;
  showSubtasks: boolean;
  permissions: SystemPermissions;
  currentUserId: string;
  wipLimits: WipLimits;
}) {
  const visible = showSubtasks ? tasks : tasks.filter((t) => !t.parentTaskId);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function tasksFor(status: TaskStatus) {
    return visible.filter((t) => t.status === status);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const draggedTask = visible.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const overIsColumn = TASK_STATUSES.includes(over.id as TaskStatus);
    const overTask = overIsColumn ? null : visible.find((t) => t.id === over.id);
    const targetStatus: TaskStatus = overIsColumn
      ? (over.id as TaskStatus)
      : (overTask?.status ?? draggedTask.status);

    const targetColumnTasks = visible.filter((t) => t.status === targetStatus && t.id !== draggedTask.id);
    let targetIndex = targetColumnTasks.length;
    if (overTask && overTask.id !== draggedTask.id) {
      const idx = targetColumnTasks.findIndex((t) => t.id === overTask.id);
      if (idx !== -1) targetIndex = idx;
    }

    if (targetStatus === draggedTask.status && tasksFor(targetStatus).findIndex((t) => t.id === draggedTask.id) === targetIndex) {
      return;
    }

    await onMove(draggedTask, targetStatus, targetIndex);
  }

  async function handleSubmitAdd(status: TaskStatus) {
    if (!newTitle.trim()) return;
    await onAdd(newTitle.trim(), status);
    setNewTitle("");
    setAddingTo(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event: DragStartEvent) => setActiveTask(visible.find((t) => t.id === event.active.id) ?? null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasksFor(status)}
            onCardClick={onOpen}
            addingTo={addingTo}
            newTitle={newTitle}
            onStartAdd={setAddingTo}
            onCancelAdd={() => {
              setAddingTo(null);
              setNewTitle("");
            }}
            onChangeNewTitle={setNewTitle}
            onSubmitAdd={handleSubmitAdd}
            permissions={permissions}
            currentUserId={currentUserId}
            wipLimit={status === "in_progress" ? wipLimits.inProgress : status === "review" ? wipLimits.review : null}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} permissions={permissions} currentUserId={currentUserId} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
