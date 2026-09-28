export type StaffMember = { id: string; name: string; email?: string | null };
export type AssigneeOption = { value: string; label: string };

export function parseAssigneeSelection(value: string): { assigneeId: string | null } {
  if (!value) return { assigneeId: null };
  return { assigneeId: value };
}

export function buildAssigneeOptions(staff: StaffMember[]): AssigneeOption[] {
  return staff.map((s) => ({ value: s.id, label: s.name }));
}

export function currentAssigneeValue(task: { assignee?: { id: string } | null }) {
  return task.assignee?.id ?? "";
}

export function resolveAssigneeLabel(task: { assignee?: { id: string; name: string } | null }) {
  return task.assignee?.name ?? null;
}
