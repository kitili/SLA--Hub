"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Phase = "unassigned" | "in_progress" | "complete";
type Priority = "low" | "medium" | "high" | "urgent";
type Impact = "individual" | "classroom" | "campus";

export function TicketQuickActions({
  ticketId,
  currentUserId,
  canManageTickets,
  phase,
  priority,
  impact,
  campus,
  dueAt,
  assignees,
  staff,
}: {
  ticketId: string;
  currentUserId: string;
  canManageTickets: boolean;
  phase: Phase;
  priority: Priority;
  impact: Impact;
  campus: string | null;
  dueAt: string | null;
  assignees: { id: string; name: string }[];
  staff: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState("");

  const isSelfAssigned = assignees.some((a) => a.id === currentUserId);
  const canTakeOwnership = staff.some((s) => s.id === currentUserId);
  const canAssignOthers = canManageTickets;

  async function call(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
    setPending(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <Card>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <Label htmlFor="phase">Phase</Label>
          <Select
            id="phase"
            value={phase}
            disabled={pending}
            onChange={(e) => call(`/api/tickets/${ticketId}`, "PATCH", { phase: e.target.value as Phase })}
          >
            <option value="unassigned">Unassigned</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Complete</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            id="priority"
            value={priority}
            disabled={pending}
            onChange={(e) => call(`/api/tickets/${ticketId}`, "PATCH", { priority: e.target.value as Priority })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="impact">Impact</Label>
          <Select
            id="impact"
            value={impact}
            disabled={pending}
            onChange={(e) => call(`/api/tickets/${ticketId}`, "PATCH", { impact: e.target.value as Impact })}
          >
            <option value="individual">One person</option>
            <option value="classroom">Class / office</option>
            <option value="campus">Whole campus</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="campus">Campus</Label>
          <input
            id="campus"
            type="text"
            defaultValue={campus ?? ""}
            disabled={pending}
            placeholder="Site"
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
            onBlur={(e) => {
              const next = e.target.value.trim() || null;
              if (next !== (campus ?? null)) {
                void call(`/api/tickets/${ticketId}`, "PATCH", { campus: next });
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="dueAt">Due</Label>
          <input
            id="dueAt"
            type="date"
            defaultValue={dueAt ?? ""}
            disabled={pending}
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(e) => call(`/api/tickets/${ticketId}`, "PATCH", { dueAt: e.target.value || null })}
          />
        </div>
        <div>
          <Label>Working on this</Label>
          <div className="flex min-h-9 flex-wrap items-center gap-1">
            {assignees.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-gray-light px-2 py-0.5 text-xs text-black/70">
                {a.name}
                {(canAssignOthers || a.id === currentUserId) && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${a.name}`}
                    onClick={() => call(`/api/tickets/${ticketId}/assignees`, "DELETE", { userId: a.id })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {assignees.length === 0 && <span className="text-sm text-black/50">No one yet</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-4">
        {!isSelfAssigned && canTakeOwnership && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => call(`/api/tickets/${ticketId}/assignees`, "POST", { userId: currentUserId })}
          >
            Take ownership
          </Button>
        )}

        {canAssignOthers && (
          <>
            <Select
              value={assignTarget}
              onChange={(e) => setAssignTarget(e.target.value)}
              className="w-auto max-w-56"
            >
              <option value="">Assign someone…</option>
              {staff
                .filter((s) => !assignees.some((a) => a.id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Button
              variant="ghost"
              disabled={pending || !assignTarget}
              onClick={() =>
                call(`/api/tickets/${ticketId}/assignees`, "POST", { userId: assignTarget }).then(() =>
                  setAssignTarget(""),
                )
              }
            >
              Add
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
