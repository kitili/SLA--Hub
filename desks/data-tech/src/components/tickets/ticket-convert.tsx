"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ProjectSprint } from "@/lib/task-types";

export function TicketConvert({
  ticketId,
  systems,
  linkedTask,
}: {
  ticketId: string;
  systems: { id: string; name: string }[];
  linkedTask: { id: string; systemId: string; title: string } | null;
}) {
  const router = useRouter();
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [sprintId, setSprintId] = useState("");
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!systemId) return;
    void fetch(`/api/systems/${systemId}/sprints`)
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.sprints ?? []) as ProjectSprint[];
        setSprints(rows.filter((s) => s.status !== "completed"));
        setSprintId("");
      })
      .catch(() => setSprints([]));
  }, [systemId]);

  if (linkedTask) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-medium text-black/60">Linked task</h2>
        <a href={`/dashboard/systems/${linkedTask.systemId}`} className="text-sm text-navy underline">
          {linkedTask.title}
        </a>
      </Card>
    );
  }

  if (systems.length === 0) return null;

  async function convert() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/tickets/${ticketId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemId, sprintId: sprintId || undefined }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the task.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <h2 className="mb-2 text-sm font-medium text-black/60">Issue onto a sprint</h2>
      <p className="mb-3 text-sm text-black/55">
        Turns this ticket into a system task and drops it on a sprint (or the backlog).
      </p>
      {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-48 flex-1">
          <Label htmlFor="convert-system">System</Label>
          <Select id="convert-system" value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="convert-sprint">Sprint</Label>
          <Select id="convert-sprint" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
            <option value="">Backlog (no sprint)</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                Sprint {sprint.number} — {sprint.name} ({sprint.status})
              </option>
            ))}
          </Select>
        </div>
        <Button className="self-end" disabled={pending || !systemId} onClick={() => void convert()}>
          {pending ? "Issuing…" : "Issue work"}
        </Button>
      </div>
    </Card>
  );
}
