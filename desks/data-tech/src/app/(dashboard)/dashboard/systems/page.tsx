import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { systems, systemTasks } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SYSTEM_STATUS_TONE } from "@/lib/system-status";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { sortDesks } from "@/lib/desks";

export default async function SystemsListPage() {
  const { canManage } = await requireModulePage("systems", "view");

  const [rows, progressRows] = await Promise.all([
    db.query.systems.findMany({
      orderBy: asc(systems.name),
      with: { lead: { columns: SAFE_USER_COLUMNS }, department: true },
    }),
    db
      .select({ systemId: systemTasks.systemId, avgPct: sql<number>`avg(${systemTasks.completionPercentage})::int` })
      .from(systemTasks)
      .groupBy(systemTasks.systemId),
  ]);
  const progressBySystem = new Map(progressRows.map((r) => [r.systemId, r.avgPct]));
  const groups = new Map<string, typeof rows>();
  for (const system of rows) {
    const key = system.department?.name ?? "Unassigned";
    const list = groups.get(key) ?? [];
    list.push(system);
    groups.set(key, list);
  }
  const orderedGroups = sortDesks([...groups.keys()].map((name) => ({ name }))).map((d) => [d.name, groups.get(d.name)!] as const);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-navy">Projects</h1>
          <p className="mt-1 text-sm text-black/60">
            Boards with phases and sprints, grouped by department.{" "}
            <Link href="/dashboard/sprints" className="text-navy underline">
              Current sprints
            </Link>
          </p>
        </div>
        {canManage && (
          <Link href="/dashboard/systems/new">
            <Button>Add project</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {orderedGroups.map(([department, systemsInDesk]) => (
          <section key={department}>
            <h2 className="mb-3 text-sm font-medium text-navy">{department}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {systemsInDesk.map((system) => {
                const progress = progressBySystem.get(system.id) ?? 0;
                return (
                  <Link key={system.id} href={`/dashboard/systems/${system.id}`}>
                    <Card className="h-full transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(0,35,104,0.55)]">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-medium text-navy">{system.name}</h3>
                        <div className="flex shrink-0 gap-1">
                          <Badge tone={system.state === "open" ? "success" : "neutral"}>{system.state}</Badge>
                          <Badge tone={SYSTEM_STATUS_TONE[system.status]}>{system.status.replace("_", " ")}</Badge>
                        </div>
                      </div>
                      <div className="mb-2 text-xs text-black/50">Lead: {system.lead?.name ?? "Unassigned"}</div>
                      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-accent to-gold-accent" style={{ width: `${progress}%` }} />
                      </div>
                      {system.description && (
                        <p className="mb-3 line-clamp-2 text-sm text-black/70">{system.description}</p>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-black/50">No systems cataloged yet.</p>
        )}
      </div>
    </div>
  );
}
