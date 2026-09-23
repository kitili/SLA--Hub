import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "../client";
import {
  accessEvents,
  type AccessAction,
  type AccessEvent,
} from "../schema/access-events";
import { touchLastActive } from "./staff";

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

export async function recordAccessEvent(input: AccessEventInput): Promise<AccessEvent | null> {
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
    return await db
      .select()
      .from(accessEvents)
      .orderBy(desc(accessEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 300));
  } catch {
    return [];
  }
}

export async function countRecentSignIns(hours = 24): Promise<number> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({ id: accessEvents.id })
      .from(accessEvents)
      .where(and(eq(accessEvents.action, "signed_in"), gte(accessEvents.createdAt, since)));
    return rows.length;
  } catch {
    return 0;
  }
}
