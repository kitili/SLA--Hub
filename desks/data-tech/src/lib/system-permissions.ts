// Pure — no server-only imports — so this is safe to use from both API routes and client
// components (kanban board / task card) without pulling the DB client into the browser bundle.

export type SystemPermissions = {
  canCreateTask: boolean;
  canEditTask: boolean;
  canAssignTask: boolean;
  canDeleteTask: boolean;
  isManagerOrLead: boolean;
  isOpen: boolean;
};

export function getSystemPermissions(params: {
  isAdmin: boolean;
  canManageModule: boolean;
  userId: string;
  leadId: string | null;
  state: "open" | "closed";
}): SystemPermissions {
  const isLead = params.leadId === params.userId;
  const isManagerOrLead = params.isAdmin || params.canManageModule || isLead;
  const isOpen = params.state === "open";
  return {
    canCreateTask: isManagerOrLead || isOpen,
    canEditTask: isManagerOrLead || isOpen,
    canAssignTask: isManagerOrLead || isOpen,
    canDeleteTask: isManagerOrLead,
    isManagerOrLead,
    isOpen,
  };
}

// Closed projects: everyone else may still drag their own assigned task between columns.
export function canMoveTask(
  permissions: Pick<SystemPermissions, "isManagerOrLead" | "isOpen">,
  task: { assigneeId: string | null; assigneeIds?: string[] },
  userId: string,
) {
  return (
    permissions.isManagerOrLead ||
    permissions.isOpen ||
    task.assigneeId === userId ||
    Boolean(task.assigneeIds?.includes(userId))
  );
}
