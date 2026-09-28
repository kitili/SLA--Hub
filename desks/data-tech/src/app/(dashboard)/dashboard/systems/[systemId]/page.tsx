import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { systems, users } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { hasModuleAccess } from "@/lib/modules";
import { getSystemPermissions } from "@/lib/system-permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskWorkspace } from "@/components/systems/task-workspace";
import { SYSTEM_STATUS_TONE } from "@/lib/system-status";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { loadBoardTasks } from "@/lib/task-workspace";
import { loadPhases, loadSprints } from "@/lib/planning";

export default async function SystemDetailPage({ params }: { params: Promise<{ systemId: string }> }) {
  const { systemId } = await params;
  const { session, isAdmin, canManage } = await requireModulePage("systems", "view");

  const system = await db.query.systems.findFirst({
    where: eq(systems.id, systemId),
    with: { lead: { columns: SAFE_USER_COLUMNS }, department: true },
  });
  if (!system) notFound();

  const [tasks, phases, sprints, staff] = await Promise.all([
    loadBoardTasks(systemId),
    loadPhases(systemId),
    loadSprints(systemId),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name)),
  ]);

  const permissions = getSystemPermissions({
    isAdmin,
    canManageModule: hasModuleAccess(session.user.modules, "systems", "manage"),
    userId: session.user.id,
    leadId: system.leadId,
    state: system.state,
  });

  const avgCompletion = tasks.length
    ? Math.round(tasks.reduce((sum, t) => sum + t.completionPercentage, 0) / tasks.length)
    : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium text-navy">{system.name}</h1>
        <Badge tone={system.state === "open" ? "success" : "neutral"}>{system.state}</Badge>
        <Badge tone={SYSTEM_STATUS_TONE[system.status]}>{system.status.replace("_", " ")}</Badge>
        {system.department && (
          <Link href={`/dashboard/desks/${system.department.id}`} className="text-sm text-navy underline">
            {system.department.name} desk
          </Link>
        )}
        {system.url && (
          <a href={system.url} target="_blank" rel="noreferrer" className="text-sm text-navy underline">
            Visit
          </a>
        )}
        {canManage && (
          <Link href={`/dashboard/systems/${system.id}/edit`}>
            <Button variant="ghost">Edit</Button>
          </Link>
        )}
      </div>

      <Card className="mb-6">
        {system.description && <p className="text-sm text-black/80">{system.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-black/70">
          <span>Lead: {system.lead?.name ?? "Unassigned"}</span>
          {system.department && <span>Desk: {system.department.name}</span>}
          {(system.startDate || system.targetDate) && (
            <span>
              Timeline: {system.startDate ? new Date(system.startDate).toLocaleDateString() : "—"} →{" "}
              {system.targetDate ? new Date(system.targetDate).toLocaleDateString() : "—"}
            </span>
          )}
        </div>
        <div className="mt-2">
          <div className="mb-1 text-xs text-black/50">Overall progress: {avgCompletion}%</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full bg-blue-accent" style={{ width: `${avgCompletion}%` }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {system.features.length > 0 && (
            <div>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-black/50">Features</h2>
              <ul className="flex flex-col gap-0.5 text-sm text-black/80">
                {system.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}
          {system.techStack.length > 0 && (
            <div>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-black/50">Tech stack</h2>
              <div className="flex flex-wrap gap-1">
                {system.techStack.map((t, i) => (
                  <span key={i} className="rounded-full bg-gray-light px-2 py-0.5 text-xs text-black/60">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <TaskWorkspace
        systemId={system.id}
        initialTasks={tasks}
        initialPhases={phases}
        initialSprints={sprints}
        wipLimits={{ inProgress: system.wipInProgress, review: system.wipReview }}
        staff={staff}
        permissions={permissions}
        currentUserId={session.user.id}
      />
    </div>
  );
}
