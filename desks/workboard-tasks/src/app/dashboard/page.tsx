import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardStats, getDefaultOrganization } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const org = await getDefaultOrganization();
  const { counts, recentActivity } = await getDashboardStats(org?.id);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Operations dashboard</h2>
        <p className="mt-1 text-zinc-600">
          {org ? `${org.name} — live task and chat activity` : "No organization seeded yet"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active users" value={counts.users} />
        <StatCard label="In progress" value={counts.inProgress} />
        <StatCard label="Backlog" value={counts.backlog} />
        <StatCard label="Completed" value={counts.completed} />
        <StatCard label="Blocked" value={counts.blocked} />
        <StatCard label="Daily plans today" value={counts.dailyPlansToday} />
        <StatCard label="Messages today" value={counts.messagesToday} />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="font-semibold">Recent task activity</h3>
        </div>
        <div className="divide-y divide-zinc-100">
          {recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-500">No activity yet. Connect WhatsApp to begin.</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium">{activity.task.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {activity.type.replaceAll("_", " ").toLowerCase()}
                    {activity.user?.name ? ` · ${activity.user.name}` : activity.user?.phone ? ` · ${activity.user.phone}` : ""}
                  </p>
                  {activity.message ? (
                    <p className="mt-1 text-sm text-zinc-500">{activity.message}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <StatusBadge status={activity.task.status} />
                  <p className="mt-2 text-xs text-zinc-400">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
