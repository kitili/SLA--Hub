import Link from "next/link";
import { requireModulePage } from "@/lib/require-module-page";
import { loadCurrentSprints, loadVelocity } from "@/lib/planning";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CurrentSprintsPage() {
  await requireModulePage("systems", "view");
  const sprints = await loadCurrentSprints();
  const systemIds = [...new Set(sprints.map((s) => s.systemId).filter(Boolean))] as string[];
  const velocities = await Promise.all(systemIds.map(async (id) => [id, await loadVelocity(id)] as const));
  const velocityBySystem = new Map(velocities);

  const active = sprints.filter((s) => s.status === "active");
  const planned = sprints.filter((s) => s.status === "planned");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium text-navy">Current sprints</h1>
        <p className="mt-1 text-sm text-black/55">
          Active and planned sprints. Open a card to work the board.{" "}
          <Link href="/dashboard/systems" className="text-navy underline">
            All projects
          </Link>
        </p>
      </div>

      <h2 className="mb-3 text-sm font-medium text-black/60">Active</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {active.map((sprint) => {
          const velocity = sprint.systemId ? velocityBySystem.get(sprint.systemId) : undefined;
          const pct = sprint.taskCount ? Math.round((sprint.doneCount / sprint.taskCount) * 100) : 0;
          return (
            <Link key={sprint.id} href={`/dashboard/systems/${sprint.systemId}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-medium text-navy">{sprint.systemName}</h3>
                  <Badge tone="success">Active</Badge>
                </div>
                <p className="text-sm text-black/70">
                  Sprint {sprint.number}: {sprint.name}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  {sprint.phaseName ?? "No phase"} · {sprint.startDate ?? "—"} → {sprint.endDate ?? "—"}
                </p>
                {sprint.goal && <p className="mt-2 text-sm text-black/60">{sprint.goal}</p>}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-blue-accent" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-black/55">
                  <span>
                    {sprint.doneCount}/{sprint.taskCount} tasks
                  </span>
                  <span>
                    {sprint.pointsDone}/{sprint.pointsCommitted} pts
                  </span>
                  <span>Velocity {velocity?.averagePoints ?? 0}</span>
                </div>
              </Card>
            </Link>
          );
        })}
        {active.length === 0 && <p className="text-sm text-black/45">No sprint is running right now.</p>}
      </div>

      <h2 className="mb-3 text-sm font-medium text-black/60">Planned</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {planned.map((sprint) => (
          <Link key={sprint.id} href={`/dashboard/systems/${sprint.systemId}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium text-navy">{sprint.systemName}</h3>
                <Badge tone="info">Planned</Badge>
              </div>
              <p className="text-sm text-black/70">
                Sprint {sprint.number}: {sprint.name}
              </p>
              <p className="mt-1 text-xs text-black/45">
                {sprint.taskCount} tasks ready · {sprint.pointsCommitted} pts
              </p>
            </Card>
          </Link>
        ))}
        {planned.length === 0 && <p className="text-sm text-black/45">Nothing planned after the current cycle.</p>}
      </div>
    </div>
  );
}
