import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { getDefaultOrganization, getTasks } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const org = await getDefaultOrganization();
  const tasks = await getTasks(org?.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Issues</h2>
        <p className="mt-1 text-zinc-600">All work items from boards, WhatsApp, and daily plans</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Key</th>
              <th className="px-5 py-3 font-medium">Summary</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Assignee</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                  No tasks yet
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id}>
                  <td className="px-5 py-4 text-sm font-medium text-blue-600">
                    {task.taskKey ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-zinc-900">{task.title}</p>
                    {task.blockerNote ? (
                      <p className="mt-1 text-xs text-amber-700">{task.blockerNote}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{task.source}</td>
                  <td className="px-5 py-4 text-zinc-600">
                    {task.assignee?.name ?? task.assignee?.phone ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{task.project?.name ?? "—"}</td>
                  <td className="px-5 py-4 text-zinc-500">
                    {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
