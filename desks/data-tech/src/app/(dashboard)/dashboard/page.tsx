import Link from "next/link";
import { and, asc, desc, eq, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { departments, systemTasks, tickets } from "@/db/schema";
import { requireLoginPage } from "@/lib/require-module-page";
import { formatFriendlyDate, isBeforeDeadline, nairobiDateString } from "@/lib/nairobi";
import { loadMine } from "@/lib/one-to-fives";
import { isSprintContainerTitle, loadMyWork } from "@/lib/desks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OneToFiveForm } from "@/components/one-to-fives/one-to-five-form";
import { WorkList } from "@/components/desk/work-list";

export default async function DashboardOverviewPage() {
  const { session } = await requireLoginPage("one_to_fives");
  const workDate = nairobiDateString();
  const [mine, myWork, myTickets, overdueTasks, myDepartment] = await Promise.all([
    loadMine(session.user.id, workDate),
    loadMyWork(session.user.id),
    db.query.tickets.findMany({
      where: ne(tickets.phase, "complete"),
      orderBy: desc(tickets.updatedAt),
      with: { assignees: true },
      limit: 40,
    }),
    db.query.systemTasks.findMany({
      where: and(
        eq(systemTasks.archived, false),
        ne(systemTasks.status, "done"),
        isNotNull(systemTasks.dueDate),
        lt(systemTasks.dueDate, workDate),
      ),
      orderBy: asc(systemTasks.dueDate),
      limit: 8,
      with: { system: true },
    }),
    session.user.departmentId
      ? db
          .select({ id: departments.id, name: departments.name })
          .from(departments)
          .where(eq(departments.id, session.user.departmentId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const assignedTickets = myTickets.filter((t) => t.assignees.some((a) => a.userId === session.user.id)).slice(0, 5);
  const showTickets = session.user.role === "admin" || Boolean(session.user.modules.tickets);
  const overdueMine = overdueTasks
    .filter(
      (task) =>
        !isSprintContainerTitle(task.title) &&
        (task.assigneeId === session.user.id || myWork.some((item) => item.id === task.id)),
    )
    .slice(0, 4);
  const deadlinePassed = !isBeforeDeadline(new Date(), workDate);
  const sent = Boolean(mine.todayRow?.submittedAt && mine.todayRow.status !== "missed");
  const closed = Boolean(mine.todayRow?.closedAt);
  const teamHref = myDepartment ? `/dashboard/desks/${myDepartment.id}` : "/dashboard/desks";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy px-6 py-6 text-white shadow-[0_24px_50px_-32px_rgba(0,35,104,0.9)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(420px 160px at 100% 0%, rgba(255,201,82,0.28), transparent 60%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "auto, 22px 22px, 22px 22px",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold-accent">Today</p>
          <h1 className="mt-2 text-3xl font-medium">{(session.user.name ?? "there").split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-white/65">
            {formatFriendlyDate(workDate)}
            {myDepartment ? ` · ${myDepartment.name}` : ""}
            {sent ? (closed ? " · day closed" : " · 1–5 sent") : mine.workDay ? " · send your 1–5" : " · off today"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={teamHref} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 transition hover:bg-white/15">
              Open team desk
            </Link>
            <Link href="/dashboard/snapshot" className="rounded-full border border-white/15 px-3 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-white">
              Weekly snapshot
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <OneToFiveForm
          workDate={workDate}
          workDay={mine.workDay}
          friendlyDate={formatFriendlyDate(workDate)}
          current={mine.todayRow ?? null}
          previousDate={mine.previousDate}
          previous={mine.previousRow ?? null}
          history={mine.history.filter((row) => row.workDate !== workDate)}
          deadlinePassed={deadlinePassed}
          suggestions={myWork.map((item) => ({ title: item.title, systemName: item.systemName }))}
        />

        <div className="flex flex-col gap-4">
          <WorkList
            title="Your work"
            items={myWork.slice(0, 6)}
            empty="Nothing on your boards yet. Open the team desk to pick up a task."
            href={teamHref}
          />

          {showTickets && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-navy">Tickets</h2>
                <Link href="/dashboard/tickets?mine=1" className="text-xs text-navy underline">
                  All tickets
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {assignedTickets.map((ticket) => (
                  <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-navy">
                      {ticket.ticketNumber} — {ticket.issue}
                    </span>
                    <Badge tone={ticket.priority === "urgent" ? "danger" : "neutral"}>{ticket.priority}</Badge>
                  </Link>
                ))}
                {assignedTickets.length === 0 && <p className="text-sm text-black/45">None assigned to you.</p>}
              </div>
            </Card>
          )}

          {overdueMine.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-navy">Overdue</h2>
              <div className="flex flex-col gap-2">
                {overdueMine.map((task) => (
                  <Link key={task.id} href={`/dashboard/systems/${task.systemId}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-navy">
                      #{task.taskNumber} {task.title}
                    </span>
                    <span className="shrink-0 text-xs text-red-600">{task.system?.name}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
