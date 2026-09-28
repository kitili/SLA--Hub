import { startOfDay } from "date-fns";
import { db } from "@/lib/db";

export const UPDATES_PAGE_SIZE = 12;

type NoteKind = "PROGRESS" | "CHALLENGE";

export type UpdateFilter = {
  authorId?: string;
  query?: string;
  day?: "today" | "past";
  from?: Date;
  to?: Date;
};

function noteWhere(organizationId: string, kind: NoteKind | null, filter: UpdateFilter) {
  const today = startOfDay(new Date());
  const query = filter.query?.trim();
  const author =
    filter.authorId || query
      ? {
          ...(filter.authorId ? { id: filter.authorId } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { username: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        }
      : undefined;

  let planDate: Date | { lt?: Date; lte?: Date; gte?: Date } | undefined;
  if (filter.day === "today") {
    planDate = today;
  } else if (filter.day === "past") {
    const end = filter.to && filter.to < today ? filter.to : undefined;
    planDate = {
      lt: today,
      ...(filter.from ? { gte: filter.from } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  return {
    organizationId,
    ...(kind ? { kind } : {}),
    ...(author ? { author } : {}),
    ...(planDate ? { planDate } : {}),
  };
}

export async function countUnreadUpdates(organizationId: string, userId: string) {
  return db.progressUpdate.count({
    where: {
      organizationId,
      planDate: startOfDay(new Date()),
      authorId: { not: userId },
      NOT: { readByIds: { has: userId } },
    },
  });
}

export async function listUpdates(
  organizationId: string,
  userId: string,
  page: number,
  kind: NoteKind | null,
  filter: UpdateFilter = {},
) {
  const where = noteWhere(organizationId, kind, filter);
  const total = await db.progressUpdate.count({ where });
  const pages = Math.max(1, Math.ceil(total / UPDATES_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pages);
  const updates = await db.progressUpdate.findMany({
    where,
    include: { author: { select: { id: true, name: true, username: true } } },
    orderBy: filter.day === "past" ? [{ planDate: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    skip: (safePage - 1) * UPDATES_PAGE_SIZE,
    take: UPDATES_PAGE_SIZE,
  });

  const unreadIds = updates
    .filter((item) => item.authorId !== userId && !item.readByIds.includes(userId))
    .map((item) => item.id);
  if (unreadIds.length) {
    await db.progressUpdate.updateMany({
      where: { id: { in: unreadIds } },
      data: { readByIds: { push: userId } },
    });
  }

  return {
    page: safePage,
    pages,
    total,
    updates: updates.map((item) => ({
      id: item.id,
      body: item.body,
      kind: item.kind,
      planDate: item.planDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      authorName: item.author.name ?? item.author.username ?? "Someone",
      mine: item.authorId === userId,
      unread: unreadIds.includes(item.id),
    })),
  };
}

export async function listUpdatesForExport(organizationId: string, kind: NoteKind | null, filter: UpdateFilter) {
  return db.progressUpdate.findMany({
    where: noteWhere(organizationId, kind, { ...filter, day: "past" }),
    include: { author: { select: { name: true, username: true } } },
    orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });
}
