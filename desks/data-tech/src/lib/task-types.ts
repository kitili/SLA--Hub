export const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#94a3b8",
  todo: "#80bfec",
  in_progress: "#7B68EE",
  review: "#ffc952",
  done: "#22c55e",
};

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Normal",
  low: "Low",
};

export const TASK_RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

export type Person = { id: string; name: string; email?: string | null };

export type TaskTag = { id: string; name: string; color: string };

export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export type ProjectPhase = {
  id: string;
  name: string;
  goal: string | null;
  position: number;
  startDate: string | null;
  targetDate: string | null;
  taskCount: number;
  doneCount: number;
};

export type ProjectSprint = {
  id: string;
  systemId?: string;
  systemName?: string;
  phaseId: string | null;
  phaseName: string | null;
  number: number;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
  doneCount: number;
  pointsCommitted: number;
  pointsDone: number;
  reviewNotes: string | null;
  retroWentWell: string | null;
  retroImprove: string | null;
  retroActions: string | null;
};

export type WipLimits = {
  inProgress: number | null;
  review: number | null;
};

export type SprintCapacity = {
  userId: string;
  name: string;
  points: number;
  minutes: number;
  assignedPoints: number;
  assignedMinutes: number;
};

export type BurndownPoint = {
  date: string;
  ideal: number;
  remaining: number;
};

export type SprintVelocity = {
  averagePoints: number;
  samples: { number: number; name: string; pointsDone: number }[];
};

export type BoardTask = {
  id: string;
  systemId: string;
  parentTaskId: string | null;
  phaseId: string | null;
  sprintId: string | null;
  phaseName: string | null;
  sprintName: string | null;
  taskNumber: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  completionPercentage: number;
  startDate: string | null;
  dueDate: string | null;
  timeEstimateMinutes: number | null;
  timeSpentMinutes: number;
  points: number | null;
  recurrence: TaskRecurrence;
  archived: boolean;
  position: number;
  assignee: Person | null;
  assignees: Person[];
  tags: TaskTag[];
  subtaskCount: number;
  subtaskDone: number;
  checklistDone: number;
  checklistTotal: number;
  commentCount: number;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  assigneeId: string | null;
  position: number;
};

export type Checklist = {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: Person | null;
};

export type TaskAttachment = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type TimeEntry = {
  id: string;
  minutes: number;
  note: string | null;
  spentOn: string | null;
  createdAt: string;
  user: Person | null;
};

export type TaskActivity = {
  id: string;
  verb: string;
  detail: string | null;
  createdAt: string;
  actor: Person | null;
};

export type TaskDependency = { id: string; title: string; status: TaskStatus; taskNumber: number };

export type TaskDetail = BoardTask & {
  watchers: Person[];
  checklists: Checklist[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  timeEntries: TimeEntry[];
  activity: TaskActivity[];
  blockedBy: TaskDependency[];
  blocking: TaskDependency[];
  subtasks: BoardTask[];
};
