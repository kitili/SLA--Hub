import { and, asc, desc, eq, ilike, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  tickets,
  ticketStatusHistory,
  ticketNotifyRecipients,
  userModules,
  type ticketPhaseEnum,
} from "@/db/schema";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { TICKET_CATEGORIES, TICKET_IMPACTS, TICKET_SOURCES } from "@/lib/ticket-constants";

type TicketPhase = (typeof ticketPhaseEnum.enumValues)[number];

/** Tickets are owned by the Data & Tech developers (tickets manage + tech role), not board desks. */
export async function listTicketDevelopers() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .innerJoin(
      userModules,
      and(eq(userModules.userId, users.id), eq(userModules.module, "tickets"), eq(userModules.level, "manage")),
    )
    .where(and(eq(users.isActive, true), eq(users.role, "tech")))
    .orderBy(asc(users.name));
}

export async function isTicketDeveloper(userId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(
      userModules,
      and(eq(userModules.userId, users.id), eq(userModules.module, "tickets"), eq(userModules.level, "manage")),
    )
    .where(and(eq(users.id, userId), eq(users.isActive, true), eq(users.role, "tech")))
    .limit(1);
  return Boolean(row);
}

export async function nextTicketNumber() {
  const rows = await db.execute<{ nextval: string }>(sql`select nextval('ticket_number_seq') as nextval`);
  const nextval = rows[0]?.nextval;
  return `TCK-${String(nextval).padStart(6, "0")}`;
}

export async function getInternalNotifyRecipients() {
  const configured = await db
    .select({ email: ticketNotifyRecipients.email })
    .from(ticketNotifyRecipients)
    .where(eq(ticketNotifyRecipients.isActive, true));

  const extra = (process.env.EMAIL_INTERNAL_NOTIFY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Nobody configured under Settings yet — fall back to active admins plus anyone with
  // Tickets manage-level access, so new-ticket notifications don't silently go nowhere
  // before someone sets this up.
  if (configured.length === 0 && extra.length === 0) {
    const staff = await db
      .selectDistinct({ email: users.email })
      .from(users)
      .leftJoin(
        userModules,
        and(eq(userModules.userId, users.id), eq(userModules.module, "tickets"), eq(userModules.level, "manage")),
      )
      .where(and(eq(users.isActive, true), or(eq(users.role, "admin"), sql`${userModules.id} is not null`)));

    return staff.map((u) => u.email);
  }

  return Array.from(new Set([...configured.map((r) => r.email), ...extra]));
}

export async function updateTicketPhase(params: {
  ticketId: string;
  toPhase: TicketPhase;
  changedBy: string;
}) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(tickets).where(eq(tickets.id, params.ticketId)).limit(1);
    if (!current) return null;

    const [updated] = await tx
      .update(tickets)
      .set({
        phase: params.toPhase,
        updatedAt: new Date(),
        resolvedAt: params.toPhase === "complete" ? new Date() : params.toPhase === "unassigned" ? null : current.resolvedAt,
      })
      .where(eq(tickets.id, params.ticketId))
      .returning();

    await tx.insert(ticketStatusHistory).values({
      ticketId: params.ticketId,
      fromPhase: current.phase,
      toPhase: params.toPhase,
      changedBy: params.changedBy,
    });

    return { previous: current, updated };
  });
}

export async function searchTickets(filters: {
  q?: string;
  phase?: string;
  priority?: string;
  category?: string;
  impact?: string;
  source?: string;
  overdue?: string;
  mine?: string;
  userId?: string;
}) {
  const conditions = [];
  if (filters.phase && ["unassigned", "in_progress", "complete"].includes(filters.phase)) {
    conditions.push(eq(tickets.phase, filters.phase as "unassigned" | "in_progress" | "complete"));
  }
  if (filters.priority && ["low", "medium", "high", "urgent"].includes(filters.priority)) {
    conditions.push(eq(tickets.priority, filters.priority as "low" | "medium" | "high" | "urgent"));
  }
  if (filters.category && (TICKET_CATEGORIES as readonly string[]).includes(filters.category)) {
    conditions.push(eq(tickets.category, filters.category as (typeof TICKET_CATEGORIES)[number]));
  }
  if (filters.impact && (TICKET_IMPACTS as readonly string[]).includes(filters.impact)) {
    conditions.push(eq(tickets.impact, filters.impact as (typeof TICKET_IMPACTS)[number]));
  }
  if (filters.source && (TICKET_SOURCES as readonly string[]).includes(filters.source)) {
    conditions.push(eq(tickets.source, filters.source as (typeof TICKET_SOURCES)[number]));
  }
  if (filters.overdue === "1") {
    conditions.push(ne(tickets.phase, "complete"), sql`${tickets.dueAt} is not null`, lt(tickets.dueAt, new Date()));
  }
  if (filters.mine === "1" && filters.userId) {
    conditions.push(
      sql`exists (select 1 from ticket_assignees ta where ta.ticket_id = ${tickets.id} and ta.user_id = ${filters.userId})`,
    );
  }
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(tickets.ticketNumber, like),
        ilike(tickets.issue, like),
        ilike(tickets.submitterName, like),
        ilike(tickets.submitterEmail, like),
        ilike(tickets.submitterPhone, like),
        ilike(tickets.placeOfWork, like),
        ilike(tickets.campus, like),
      )!,
    );
  }

  return db.query.tickets.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(tickets.createdAt),
    with: { assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } }, department: true },
    limit: 200,
  });
}
