export type BoardTask = {
  id: string;
  taskKey: string | null;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string | null;
  labels: string[];
  storyPoints: number | null;
  columnOrder: number;
  dueDate: string | null;
  blockerNote: string | null;
  authorId: string | null;
  moveOwnerId: string | null;
  sharedWithIds: string[];
  assignee: { id: string; name: string | null; username?: string | null; phone: string } | null;
  dailyItem: { slot: number } | null;
  _count: { comments: number };
};

export type BoardUser = {
  id: string;
  name: string | null;
  username?: string | null;
  phone: string;
};

export type BoardProject = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  organization: { id: string; name: string };
};
