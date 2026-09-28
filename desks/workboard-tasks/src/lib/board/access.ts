export function cardOwnerId(task: {
  moveOwnerId?: string | null;
  authorId?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string } | null;
}) {
  return task.moveOwnerId ?? task.authorId ?? task.assigneeId ?? task.assignee?.id ?? null;
}

export function canMoveTask(
  task: { moveOwnerId?: string | null; authorId?: string | null; sharedWithIds?: string[]; assignee?: { id: string } | null },
  userId: string | null,
) {
  if (!userId) return false;
  if (cardOwnerId(task) === userId) return true;
  return (task.sharedWithIds ?? []).includes(userId);
}
