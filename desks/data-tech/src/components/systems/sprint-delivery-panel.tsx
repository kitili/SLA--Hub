"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SprintBurndown } from "./sprint-burndown";
import type { Person, ProjectSprint, BurndownPoint, SprintCapacity, SprintVelocity } from "@/lib/task-types";

export function SprintDeliveryPanel({
  systemId,
  sprint,
  staff,
  canManage,
  onChanged,
}: {
  systemId: string;
  sprint: ProjectSprint;
  staff: Person[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [capacities, setCapacities] = useState<SprintCapacity[]>([]);
  const [velocity, setVelocity] = useState<SprintVelocity | null>(null);
  const [reviewNotes, setReviewNotes] = useState(sprint.reviewNotes ?? "");
  const [wentWell, setWentWell] = useState(sprint.retroWentWell ?? "");
  const [improve, setImprove] = useState(sprint.retroImprove ?? "");
  const [actions, setActions] = useState(sprint.retroActions ?? "");
  const [drafts, setDrafts] = useState<Record<string, { points: string; minutes: string }>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/systems/${systemId}/sprints/${sprint.id}/insights`)
      .then((res) => res.json())
      .then((data) => {
        setBurndown(data.burndown ?? []);
        setCapacities(data.capacities ?? []);
        setVelocity(data.velocity ?? null);
        const next: Record<string, { points: string; minutes: string }> = {};
        for (const row of (data.capacities ?? []) as SprintCapacity[]) {
          next[row.userId] = { points: String(row.points), minutes: String(row.minutes) };
        }
        setDrafts(next);
      })
      .catch(() => {});
  }, [systemId, sprint.id, sprint.taskCount, sprint.doneCount]);

  useEffect(() => {
    setReviewNotes(sprint.reviewNotes ?? "");
    setWentWell(sprint.retroWentWell ?? "");
    setImprove(sprint.retroImprove ?? "");
    setActions(sprint.retroActions ?? "");
  }, [sprint.id, sprint.reviewNotes, sprint.retroWentWell, sprint.retroImprove, sprint.retroActions]);

  async function saveNotes(complete = false) {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/systems/${systemId}/sprints/${sprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewNotes: reviewNotes || null,
        retroWentWell: wentWell || null,
        retroImprove: improve || null,
        retroActions: actions || null,
        ...(complete ? { action: "complete" } : {}),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save review.");
      return;
    }
    onChanged();
  }

  async function saveCapacity() {
    const rows = Object.entries(drafts)
      .filter(([, v]) => v.points || v.minutes)
      .map(([userId, v]) => ({
        userId,
        points: Number(v.points || 0),
        minutes: Number(v.minutes || 0),
      }));
    setPending(true);
    setError(null);
    const res = await fetch(`/api/systems/${systemId}/sprints/${sprint.id}/capacities`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save capacity.");
      return;
    }
    const data = await res.json();
    setCapacities(data.capacities ?? []);
  }

  const people = staff.filter((p) => drafts[p.id] || capacities.some((c) => c.userId === p.id));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-sm font-medium text-black/60">Burndown &amp; velocity</h3>
        {velocity && (
          <p className="mb-3 text-sm text-black/65">
            Velocity: <strong>{velocity.averagePoints}</strong> pts / sprint
            {velocity.samples.length
              ? ` (${velocity.samples.map((s) => `S${s.number}:${s.pointsDone}`).join(", ")})`
              : " — complete a sprint to start the average"}
          </p>
        )}
        <SprintBurndown points={burndown} />
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-medium text-black/60">Capacity</h3>
        <p className="mb-3 text-xs text-black/45">Points and hours this person can take in the sprint.</p>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-2">
          {(people.length ? people : staff).map((person) => {
            const load = capacities.find((c) => c.userId === person.id);
            const draft = drafts[person.id] ?? { points: String(load?.points ?? ""), minutes: String(load?.minutes ?? "") };
            const over = load && load.points > 0 && load.assignedPoints > load.points;
            return (
              <div key={person.id} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center gap-2 text-sm">
                <div>
                  <div className="text-navy">{person.name}</div>
                  <div className={`text-xs ${over ? "text-red-600" : "text-black/45"}`}>
                    {load ? `${load.assignedPoints} pts / ${Math.round(load.assignedMinutes / 60)}h assigned` : "No work yet"}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage}
                  value={draft.points}
                  placeholder="pts"
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [person.id]: { ...draft, points: e.target.value } }))}
                />
                <Input
                  type="number"
                  min={0}
                  disabled={!canManage}
                  value={draft.minutes}
                  placeholder="mins"
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [person.id]: { ...draft, minutes: e.target.value } }))}
                />
              </div>
            );
          })}
        </div>
        {canManage && (
          <Button className="mt-3" variant="secondary" disabled={pending} onClick={() => void saveCapacity()}>
            Save capacity
          </Button>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="mb-2 text-sm font-medium text-black/60">Review &amp; retro</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="review">Sprint review</Label>
            <Textarea id="review" rows={4} value={reviewNotes} disabled={!canManage} onChange={(e) => setReviewNotes(e.target.value)} placeholder="What shipped? Demo notes…" />
          </div>
          <div>
            <Label htmlFor="well">What went well</Label>
            <Textarea id="well" rows={4} value={wentWell} disabled={!canManage} onChange={(e) => setWentWell(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="improve">What to improve</Label>
            <Textarea id="improve" rows={4} value={improve} disabled={!canManage} onChange={(e) => setImprove(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="actions">Action items</Label>
            <Textarea id="actions" rows={4} value={actions} disabled={!canManage} onChange={(e) => setActions(e.target.value)} />
          </div>
        </div>
        {canManage && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => void saveNotes(false)}>
              Save notes
            </Button>
            {sprint.status === "active" && (
              <Button disabled={pending} onClick={() => void saveNotes(true)}>
                Complete sprint
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
