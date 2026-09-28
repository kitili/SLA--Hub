import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";
import { KanbanBoard } from "@/components/board/kanban-board";
import type { BoardTask } from "@/lib/board/types";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const [session, org, params] = await Promise.all([getSessionUser(), getDefaultOrganization(), searchParams]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;

  const data = await getOrganizationBoard(org.id);
  if (!data) return <p className="text-zinc-500">No organization yet.</p>;

  const tasks: BoardTask[] = data.tasks.map((task) => ({
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    description: task.description,
    status: task.status,
    type: task.type,
    priority: task.priority,
    labels: task.labels,
    storyPoints: task.storyPoints,
    columnOrder: task.columnOrder,
    dueDate: task.dueDate?.toISOString() ?? null,
    blockerNote: task.blockerNote,
    authorId: task.authorId,
    moveOwnerId: task.moveOwnerId,
    sharedWithIds: task.sharedWithIds,
    assignee: task.assignee,
    dailyItem: task.dailyItem,
    _count: task._count,
  }));

  return (
    <KanbanBoard
      initialTasks={tasks}
      users={data.users}
      currentUserId={session?.id ?? null}
      mine={params.mine === "1"}
    />
  );
}
