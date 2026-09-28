import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLoginPage } from "@/lib/require-module-page";
import { formatFriendlyDate, nairobiDateString, weekdayForDate } from "@/lib/nairobi";
import { countPhrase, loadDepartmentDesk, loadDepartmentWork } from "@/lib/desks";
import { isWorkDay } from "@/lib/one-to-fives";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OneToFivesBoard } from "@/components/one-to-fives/one-to-fives-board";
import { PulseForm } from "@/components/one-to-fives/pulse-form";
import { WorkBoard } from "@/components/desk/work-board";

export default async function DepartmentDeskPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  const { session, canManage } = await requireLoginPage("one_to_fives");
  const workDate = nairobiDateString();
  const desk = await loadDepartmentDesk(departmentId, workDate);
  if (!desk) notFound();
  const [workDay, work] = await Promise.all([isWorkDay(workDate), loadDepartmentWork(departmentId)]);
  const todayEntries = desk.entries.filter((e) => e.workDate === workDate);
  const filedToday = desk.people.filter((person) => {
    const row = todayEntries.find((e) => e.userId === person.id);
    return row?.status === "on_time" || row?.status === "late";
  }).length;
  const liveProjects = desk.projects.filter((project) => project.taskCount > 0);
  const quietProjects = desk.projects.filter((project) => project.taskCount === 0);
  const focus = liveProjects[0] ?? desk.projects[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard/desks" className="text-xs text-navy underline">
            All desks
          </Link>
          <h1 className="mt-2 text-2xl font-medium text-navy">{desk.department.name}</h1>
          <p className="mt-1 text-sm text-black/55">
            {formatFriendlyDate(workDate)} · {countPhrase(desk.people.length, "person", "people")} ·{" "}
            {filedToday}/{desk.people.length || 0} 1–5s in
          </p>
        </div>
      </div>

      {liveProjects.length > 0 && (
        <div className="flex flex-col gap-2">
          {liveProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/systems/${project.id}`}
              className="rounded-lg border border-black/10 bg-white px-4 py-3 hover:border-navy/30"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-navy">{project.name}</span>
                  {project.sprintName && <span className="ml-2 text-sm text-black/50">{project.sprintName}</span>}
                  {project.phaseName && <span className="ml-2 text-xs text-black/40">{project.phaseName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {project.sprintStatus && (
                    <Badge tone={project.sprintStatus === "active" ? "success" : "info"}>{project.sprintStatus}</Badge>
                  )}
                  <span className="text-xs text-black/50">
                    {project.doneCount}/{project.taskCount} · {project.pct}%
                  </span>
                </div>
              </div>
              <ProgressBar value={project.pct} />
            </Link>
          ))}
        </div>
      )}

      <WorkBoard
        title="Open work"
        items={work}
        empty="No open tasks on this desk."
        href={focus ? `/dashboard/systems/${focus.id}` : undefined}
      />

      <OneToFivesBoard
        workDate={workDate}
        workDay={workDay}
        people={desk.people}
        entries={todayEntries}
        departments={[desk.department]}
      />

      <PulseForm
        weekThursday={desk.weekThursday}
        isThursday={weekdayForDate(workDate) === 4}
        departments={[desk.department]}
        pulses={desk.pulse ? [{ ...desk.pulse, department: desk.department }] : []}
        defaultDepartmentId={desk.department.id}
        canManage={canManage || session.user.departmentId === desk.department.id}
      />

      {quietProjects.length > 0 && (
        <p className="text-xs text-black/40">
          Also on this desk:{" "}
          {quietProjects.map((project, index) => (
            <span key={project.id}>
              {index > 0 ? ", " : ""}
              <Link href={`/dashboard/systems/${project.id}`} className="underline">
                {project.name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
