"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SystemPermissions } from "@/lib/system-permissions";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type BoardTask,
  type Person,
  type ProjectPhase,
  type ProjectSprint,
  type TaskPriority,
  type TaskStatus,
  type WipLimits,
} from "@/lib/task-types";
import { KanbanBoard } from "./kanban-board";
import { TaskListView } from "./task-list-view";
import { TaskCalendarView } from "./task-calendar-view";
import { TaskTimelineView } from "./task-timeline-view";
import { TaskDrawer } from "./task-drawer";
import { PhaseSprintPlanner } from "./phase-sprint-planner";

type View = "plan" | "list" | "board" | "calendar" | "timeline";

function isSameDay(value: string, date: Date) {
  return value === date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setDate(date.getDate() - date.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

export function TaskWorkspace({
  systemId,
  initialTasks,
  initialPhases,
  initialSprints,
  staff,
  permissions,
  currentUserId,
  wipLimits,
}: {
  systemId: string;
  initialTasks: BoardTask[];
  initialPhases: ProjectPhase[];
  initialSprints: ProjectSprint[];
  staff: Person[];
  permissions: SystemPermissions;
  currentUserId: string;
  wipLimits: WipLimits;
}) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [phases, setPhases] = useState<ProjectPhase[]>(initialPhases);
  const [sprints, setSprints] = useState<ProjectSprint[]>(initialSprints);
  const [view, setView] = useState<View>("plan");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  async function refresh() {
    const [taskRes, phaseRes, sprintRes] = await Promise.all([
      fetch(`/api/systems/${systemId}/tasks${showArchived ? "?archived=1" : ""}`),
      fetch(`/api/systems/${systemId}/phases`),
      fetch(`/api/systems/${systemId}/sprints`),
    ]);
    if (taskRes.ok) {
      const data = await taskRes.json();
      setTasks(data.tasks ?? []);
    }
    if (phaseRes.ok) {
      const data = await phaseRes.json();
      setPhases(data.phases ?? []);
    }
    if (sprintRes.ok) {
      const data = await sprintRes.json();
      setSprints(data.sprints ?? []);
    }
  }

  async function handleAdd(title: string, status: TaskStatus) {
    const active = sprints.find((s) => s.status === "active");
    const res = await fetch(`/api/systems/${systemId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status,
        sprintId: sprintFilter || active?.id || undefined,
        phaseId: phaseFilter || undefined,
      }),
    });
    if (res.ok) await refresh();
  }

  async function handleMove(task: BoardTask, status: TaskStatus, index: number) {
    setBoardError(null);
    const res = await fetch(`/api/systems/${systemId}/tasks/${task.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, index }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setBoardError(data.error ?? "Could not move that task.");
      await refresh();
      return;
    }
    await refresh();
  }

  const filtered = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return tasks.filter((task) => {
      if (!showArchived && task.archived) return false;
      if (query && !`${task.title} ${task.description ?? ""}`.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (assigneeFilter === "me" && !task.assignees.some((a) => a.id === currentUserId)) return false;
      if (assigneeFilter === "unassigned" && task.assignees.length > 0) return false;
      if (assigneeFilter && assigneeFilter !== "me" && assigneeFilter !== "unassigned") {
        if (!task.assignees.some((a) => a.id === assigneeFilter)) return false;
      }
      if (dueFilter === "overdue") {
        if (!task.dueDate || task.status === "done" || new Date(task.dueDate) >= today) return false;
      }
      if (dueFilter === "today" && (!task.dueDate || !isSameDay(task.dueDate, today))) return false;
      if (dueFilter === "week") {
        if (!task.dueDate) return false;
        const due = new Date(`${task.dueDate}T12:00:00`);
        if (due < weekStart || due >= weekEnd) return false;
      }
      if (phaseFilter && task.phaseId !== phaseFilter) return false;
      if (sprintFilter === "backlog" && task.sprintId) return false;
      if (sprintFilter && sprintFilter !== "backlog" && task.sprintId !== sprintFilter) return false;
      return true;
    });
  }, [tasks, query, statusFilter, priorityFilter, assigneeFilter, dueFilter, phaseFilter, sprintFilter, showArchived, currentUserId]);

  const activeSprint = sprints.find((s) => s.status === "active");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-black/60">Work</h2>
          <p className="text-xs text-black/40">
            {activeSprint
              ? `Active sprint ${activeSprint.number}: ${activeSprint.doneCount}/${activeSprint.taskCount} done`
              : "Plan phases and sprints, then issue work into them."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-gray-light p-1">
          {(["plan", "list", "board", "calendar", "timeline"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${view === item ? "bg-white text-navy shadow-sm" : "text-black/50"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {view !== "plan" && (
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4 lg:grid-cols-8">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks"
          className="md:col-span-2"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "")}>
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
        <Select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </Select>
        <Select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
          <option value="">All phases</option>
          {phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </Select>
        <Select value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}>
          <option value="">All sprints</option>
          <option value="backlog">Backlog</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              Sprint {sprint.number}
              {sprint.status === "active" ? " (active)" : ""}
            </option>
          ))}
        </Select>
      </div>
      )}

      {view !== "plan" && (
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-black/55">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showSubtasks} onChange={(e) => setShowSubtasks(e.target.checked)} />
          Show subtasks on board
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              void fetch(`/api/systems/${systemId}/tasks${e.target.checked ? "?archived=1" : ""}`)
                .then((res) => res.json())
                .then((data) => setTasks(data.tasks ?? []));
            }}
          />
          Show archived
        </label>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>
      )}

      {view === "plan" && (
        <PhaseSprintPlanner
          systemId={systemId}
          phases={phases}
          sprints={sprints}
          tasks={tasks}
          staff={staff}
          permissions={permissions}
          onChanged={() => void refresh()}
          onOpenTask={(task) => setOpenId(task.id)}
        />
      )}
      {view === "list" && (
        <TaskListView tasks={filtered} onOpen={(task) => setOpenId(task.id)} onAdd={handleAdd} permissions={permissions} />
      )}
      {view === "board" && (
        <>
          {boardError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{boardError}</p>}
          <KanbanBoard
            tasks={filtered}
            onOpen={(task) => setOpenId(task.id)}
            onAdd={handleAdd}
            onMove={handleMove}
            showSubtasks={showSubtasks}
            permissions={permissions}
            currentUserId={currentUserId}
            wipLimits={wipLimits}
          />
        </>
      )}
      {view === "calendar" && <TaskCalendarView tasks={filtered} onOpen={(task) => setOpenId(task.id)} />}
      {view === "timeline" && <TaskTimelineView tasks={filtered} onOpen={(task) => setOpenId(task.id)} />}

      {openId && (
        <TaskDrawer
          systemId={systemId}
          taskId={openId}
          staff={staff}
          siblingTasks={tasks.map((t) => ({ id: t.id, title: t.title, taskNumber: t.taskNumber }))}
          permissions={permissions}
          onClose={() => setOpenId(null)}
          onChanged={() => void refresh()}
          onDeleted={() => {
            setOpenId(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
