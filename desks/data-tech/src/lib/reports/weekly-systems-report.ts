import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { systems, users, userModules } from "@/db/schema";
import { daysAgo } from "@/lib/date";
import { sendEmail } from "@/lib/email/send-email";
import { weeklySystemsReportEmail } from "@/lib/email/templates/weekly-systems-report";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";

// One email per in-development system, sent every week regardless of activity level —
// the cadence itself is meant to keep leads/managers checking in, not just flag problems.
export async function sendWeeklySystemsReports() {
  const since = daysAgo(7);
  const today = new Date();

  const [inDevSystems, managerAndAdminEmails] = await Promise.all([
    db.query.systems.findMany({
      where: eq(systems.status, "in_development"),
      with: {
        lead: { columns: SAFE_USER_COLUMNS },
        tasks: true,
      },
    }),
    db
      .selectDistinct({ email: users.email })
      .from(users)
      .leftJoin(
        userModules,
        and(eq(userModules.userId, users.id), eq(userModules.module, "systems"), eq(userModules.level, "manage")),
      )
      .where(and(eq(users.isActive, true), or(eq(users.role, "admin"), sql`${userModules.id} is not null`)))
      .then((rows) => rows.map((r) => r.email)),
  ]);

  let systemsReported = 0;

  for (const system of inDevSystems) {
    const created = system.tasks.filter((t) => t.createdAt >= since);
    const completed = system.tasks.filter((t) => t.status === "done" && t.updatedAt >= since);
    const overdue = system.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "done");
    const createdOrCompletedIds = new Set([...created, ...completed].map((t) => t.id));
    const updated = system.tasks.filter((t) => t.updatedAt >= since && !createdOrCompletedIds.has(t.id));

    const recipients = new Set(managerAndAdminEmails);
    if (system.lead) recipients.add(system.lead.email);
    if (recipients.size === 0) continue;

    const { subject, html } = weeklySystemsReportEmail({
      systemName: system.name,
      systemUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/systems/${system.id}`,
      created: created.map((t) => ({ title: t.title, priority: t.priority })),
      completed: completed.map((t) => ({ title: t.title, priority: t.priority })),
      overdue: overdue.map((t) => ({ title: t.title, priority: t.priority })),
      updated: updated.map((t) => ({ title: t.title, priority: t.priority })),
    });

    await sendEmail({ to: Array.from(recipients), subject, html }).catch(() => {});
    systemsReported++;
  }

  return { systemsReported };
}
