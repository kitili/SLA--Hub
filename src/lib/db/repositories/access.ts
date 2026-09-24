import "server-only";

import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { db } from "../client";
import { ensureAccessEventsTable } from "../ensure-access";
import {
  ACCESS_ACTIONS,
  accessEvents,
  type AccessAction,
  type AccessEvent,
} from "../schema/access-events";
import { touchLastActive } from "./staff";
import { ACCESS_PAGE_SIZE, ACCESS_WINDOW_LIMIT, type AccessQuery, accessRange } from "@/lib/access-query";

const DEDUPE_MS = 2 * 60 * 1000;

export type AccessEventInput = {
  staffId: string;
  email: string;
  fullName: string;
  action: AccessAction;
  departmentId?: string | null;
  departmentName?: string | null;
  path?: string | null;
};

export type ListedAccessEvent = AccessEvent;

export type AccessPersonOption = {
  staffId: string;
  name: string;
  email: string;
};

function isAccessAction(value: string): value is AccessAction {
  return (ACCESS_ACTIONS as readonly string[]).includes(value);
}

function filterWhere(query: AccessQuery) {
  const { from, to } = accessRange(query);
  const filters: SQL[] = [gte(accessEvents.createdAt, from), lte(accessEvents.createdAt, to)];
  if (query.staffId) filters.push(eq(accessEvents.staffId, query.staffId));
  if (query.departmentId) filters.push(eq(accessEvents.departmentId, query.departmentId));
  if (isAccessAction(query.action)) filters.push(eq(accessEvents.action, query.action));
  return and(...filters);
}

export async function recordAccessEvent(input: AccessEventInput): Promise<AccessEvent | null> {
  await ensureAccessEventsTable();
  if (input.action === "opened_hub" || input.action === "opened_desk") {
    const since = new Date(Date.now() - DEDUPE_MS);
    const filters = [
      eq(accessEvents.staffId, input.staffId),
      eq(accessEvents.action, input.action),
      gte(accessEvents.createdAt, since),
    ];
    if (input.departmentId) {
      filters.push(eq(accessEvents.departmentId, input.departmentId));
    }
    const [recent] = await db
      .select({ id: accessEvents.id })
      .from(accessEvents)
      .where(and(...filters))
      .limit(1);
    if (recent) {
      await touchLastActive(input.staffId);
      return null;
    }
  }

  const [row] = await db
    .insert(accessEvents)
    .values({
      staffId: input.staffId,
      email: input.email,
      fullName: input.fullName.trim() || input.email,
      action: input.action,
      departmentId: input.departmentId ?? null,
      departmentName: input.departmentName ?? null,
      path: input.path ?? null,
    })
    .returning();

  await touchLastActive(input.staffId);
  return row ?? null;
}

export async function listAccessEvents(limit = 80): Promise<ListedAccessEvent[]> {
  try {
    await ensureAccessEventsTable();
    return await db
      .select()
      .from(accessEvents)
      .orderBy(desc(accessEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 800));
  } catch {
    return [];
  }
}

export async function queryAccessEvents(
  query: AccessQuery,
): Promise<{ rows: ListedAccessEvent[]; total: number }> {
  try {
    await ensureAccessEventsTable();
    const where = filterWhere(query);
    const offset = (query.page - 1) * ACCESS_PAGE_SIZE;
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(accessEvents)
        .where(where)
        .orderBy(desc(accessEvents.createdAt))
        .limit(ACCESS_PAGE_SIZE)
        .offset(offset),
      db.select({ n: count() }).from(accessEvents).where(where),
    ]);
    return { rows, total: Number(totals[0]?.n ?? 0) };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function listAccessWindow(query: AccessQuery): Promise<ListedAccessEvent[]> {
  try {
    await ensureAccessEventsTable();
    return await db
      .select()
      .from(accessEvents)
      .where(filterWhere({ ...query, action: "" }))
      .orderBy(desc(accessEvents.createdAt))
      .limit(ACCESS_WINDOW_LIMIT);
  } catch {
    return [];
  }
}

export async function listAccessEventsForStaff(
  staffId: string,
  limit = 200,
): Promise<ListedAccessEvent[]> {
  try {
    await ensureAccessEventsTable();
    return await db
      .select()
      .from(accessEvents)
      .where(eq(accessEvents.staffId, staffId))
      .orderBy(desc(accessEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 400));
  } catch {
    return [];
  }
}

export async function listAccessPeople(): Promise<AccessPersonOption[]> {
  try {
    await ensureAccessEventsTable();
    const rows = await db
      .selectDistinct({
        staffId: accessEvents.staffId,
        name: accessEvents.fullName,
        email: accessEvents.email,
      })
      .from(accessEvents)
      .limit(200);
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.staffId)) return false;
        seen.add(row.staffId);
        return true;
      })
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  } catch {
    return [];
  }
}

export async function countRecentSignIns(hours = 24): Promise<number> {
  try {
    await ensureAccessEventsTable();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({ n: count() })
      .from(accessEvents)
      .where(and(eq(accessEvents.action, "signed_in"), gte(accessEvents.createdAt, since)));
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
