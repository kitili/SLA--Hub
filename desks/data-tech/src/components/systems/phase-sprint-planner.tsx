"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { SystemPermissions } from "@/lib/system-permissions";
import type { BoardTask, Person, ProjectPhase, ProjectSprint, TaskPriority } from "@/lib/task-types";
import { SprintDeliveryPanel } from "./sprint-delivery-panel";

function tone(status: ProjectSprint["status"]) {
  if (status === "active") return "success" as const;
  if (status === "completed") return "neutral" as const;
  return "info" as const;
}

export function PhaseSprintPlanner({
  systemId,
  phases,
  sprints,
  tasks,
  staff,
  permissions,
  onChanged,
  onOpenTask,
}: {
  systemId: string;
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
  tasks: BoardTask[];
  staff: Person[];
  permissions: SystemPermissions;
  onChanged: () => void;
  onOpenTask: (task: BoardTask) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [phaseName, setPhaseName] = useState("");
  const [phaseGoal, setPhaseGoal] = useState("");
  const [sprintName, setSprintName] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");
  const [sprintPhaseId, setSprintPhaseId] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueSprintId, setIssueSprintId] = useState("");
  const [issuePriority, setIssuePriority] = useState<TaskPriority>("medium");
  const [pending, setPending] = useState(false);

  const canManage = permissions.isManagerOrLead;
  const canCreate = permissions.canCreateTask;
  const active = sprints.find((s) => s.status === "active");
  const planned = sprints.filter((s) => s.status === "planned");
  const completed = sprints.filter((s) => s.status === "completed");
  const backlog = tasks.filter((t) => !t.sprintId && !t.archived && !t.parentTaskId);
  const issueTarget = issueSprintId || active?.id || "";

  async function call(url: string, method: string, body?: unknown) {
    setPending(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update planning.");
      return false;
    }
    onChanged();
    return true;
  }

  async function addPhase() {
    if (!phaseName.trim()) return;
    if (await call(`/api/systems/${systemId}/phases`, "POST", { name: phaseName.trim(), goal: phaseGoal || undefined })) {
      setPhaseName("");
      setPhaseGoal("");
    }
  }

  async function addSprint() {
    if (
      await call(`/api/systems/${systemId}/sprints`, "POST", {
        name: sprintName.trim() || undefined,
        goal: sprintGoal || undefined,
        phaseId: sprintPhaseId || undefined,
      })
    ) {
      setSprintName("");
      setSprintGoal("");
    }
  }

  async function issueWork() {
    if (!issueTitle.trim()) return;
    if (
      await call(`/api/systems/${systemId}/tasks`, "POST", {
        title: issueTitle.trim(),
        status: issueTarget ? "todo" : "backlog",
        priority: issuePriority,
        sprintId: issueTarget || undefined,
        points: 1,
      })
    ) {
      setIssueTitle("");
    }
  }

  async function pullToSprint(taskId: string, sprintId: string) {
    await call(`/api/systems/${systemId}/tasks/${taskId}`, "PATCH", { sprintId, status: "todo" });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {active && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-navy">
                Active — Sprint {active.number}: {active.name}
              </h3>
              <p className="text-sm text-black/55">
                {active.phaseName ? `${active.phaseName} · ` : ""}
                {active.startDate ?? "—"} → {active.endDate ?? "—"}
                {active.goal ? ` · ${active.goal}` : ""}
              </p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="secondary" disabled={pending} onClick={() => void call(`/api/systems/${systemId}/sprints/${active.id}`, "PATCH", { action: "complete" })}>
                  Complete sprint
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => void call(`/api/systems/${systemId}/sprints/${active.id}`, "PATCH", { action: "return_unfinished" })}>
                  Leftovers → backlog
                </Button>
              </div>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-4 text-sm text-black/70">
            <span>
              {active.doneCount}/{active.taskCount} tasks
            </span>
            <span>
              {active.pointsDone}/{active.pointsCommitted || 0} points
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-blue-accent"
              style={{ width: `${active.taskCount ? Math.round((active.doneCount / active.taskCount) * 100) : 0}%` }}
            />
          </div>
        </Card>
      )}

      {(active || completed[completed.length - 1]) && (
        <SprintDeliveryPanel
          systemId={systemId}
          sprint={active ?? completed[completed.length - 1]!}
          staff={staff}
          canManage={canManage}
          onChanged={onChanged}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-black/60">Phases</h3>
          <div className="flex flex-col gap-3">
            {phases.map((phase) => (
              <div key={phase.id} className="rounded-md border border-black/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-navy">{phase.name}</div>
                    {phase.goal && <p className="text-xs text-black/50">{phase.goal}</p>}
                    <p className="mt-1 text-xs text-black/45">
                      {phase.doneCount}/{phase.taskCount} done
                      {phase.targetDate ? ` · due ${phase.targetDate}` : ""}
                    </p>
                  </div>
                  {canManage && (
                    <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => void call(`/api/systems/${systemId}/phases/${phase.id}`, "DELETE")}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {phases.length === 0 && <p className="text-sm text-black/45">No phases yet — add Discovery, Build, Rollout…</p>}
            {canManage && (
              <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
                <Label htmlFor="phase-name">New phase</Label>
                <Input id="phase-name" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="e.g. Rollout" />
                <Textarea value={phaseGoal} onChange={(e) => setPhaseGoal(e.target.value)} rows={2} placeholder="What this stage is for" />
                <Button disabled={pending || !phaseName.trim()} onClick={() => void addPhase()}>
                  Add phase
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-medium text-black/60">Sprints</h3>
          <div className="flex flex-col gap-3">
            {[...planned, ...completed.slice(-2)].map((sprint) => (
              <div key={sprint.id} className="rounded-md border border-black/10 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-navy">
                    Sprint {sprint.number}: {sprint.name}
                  </span>
                  <Badge tone={tone(sprint.status)}>{sprint.status}</Badge>
                </div>
                <p className="text-xs text-black/50">
                  {sprint.phaseName ?? "No phase"} · {sprint.startDate ?? "—"} → {sprint.endDate ?? "—"}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  {sprint.doneCount}/{sprint.taskCount} tasks · {sprint.pointsDone}/{sprint.pointsCommitted} pts
                </p>
                {canManage && sprint.status === "planned" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={pending} onClick={() => void call(`/api/systems/${systemId}/sprints/${sprint.id}`, "PATCH", { action: "start" })}>
                      Start
                    </Button>
                    <Button variant="ghost" disabled={pending} onClick={() => void call(`/api/systems/${systemId}/sprints/${sprint.id}`, "DELETE")}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {sprints.length === 0 && <p className="text-sm text-black/45">No sprints yet.</p>}
            {canManage && (
              <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
                <Label htmlFor="sprint-name">New sprint</Label>
                <Input id="sprint-name" value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="Optional name" />
                <Select value={sprintPhaseId} onChange={(e) => setSprintPhaseId(e.target.value)}>
                  <option value="">No phase</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </Select>
                <Textarea value={sprintGoal} onChange={(e) => setSprintGoal(e.target.value)} rows={2} placeholder="Sprint goal" />
                <Button disabled={pending} onClick={() => void addSprint()}>
                  Create sprint
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-medium text-black/60">Issue work</h3>
          {canCreate && (
            <div className="mb-4 flex flex-col gap-2">
              <Input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="What needs doing this sprint?" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={issueSprintId} onChange={(e) => setIssueSprintId(e.target.value)}>
                  <option value="">{active ? `Active sprint ${active.number}` : "Backlog"}</option>
                  {sprints
                    .filter((s) => s.status !== "completed")
                    .map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        Sprint {sprint.number}
                      </option>
                    ))}
                </Select>
                <Select value={issuePriority} onChange={(e) => setIssuePriority(e.target.value as TaskPriority)}>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Normal</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              <Button disabled={pending || !issueTitle.trim()} onClick={() => void issueWork()}>
                Issue to {issueTarget ? "sprint" : "backlog"}
              </Button>
            </div>
          )}

          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-black/45">Backlog</h4>
          <div className="flex flex-col gap-2">
            {backlog.map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 rounded-md bg-gray-light/70 px-2 py-1.5">
                <button type="button" className="text-left text-sm text-navy" onClick={() => onOpenTask(task)}>
                  #{task.taskNumber} {task.title}
                </button>
                {canCreate && (active || planned[0]) && (
                  <Button
                    variant="ghost"
                    className="px-2 py-0.5 text-xs"
                    disabled={pending}
                    onClick={() => void pullToSprint(task.id, active?.id ?? planned[0]!.id)}
                  >
                    Pull in
                  </Button>
                )}
              </div>
            ))}
            {backlog.length === 0 && <p className="text-sm text-black/45">Backlog is empty.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
