import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, userModules } from "@/db/schema";

// Fixed schedule shared by every "days before a date" reminder feature (subscriptions,
// tool reminder dates) — there's no per-item selection of which offsets apply.
export const REMINDER_OFFSET_DAYS = [7, 3, 2, 1, 0] as const;

// Fallback recipients when a reminder has no specific notify list: active admins plus
// anyone with Tech Tools manage-level access.
export async function getTechToolsManagerEmails() {
  const rows = await db
    .selectDistinct({ email: users.email })
    .from(users)
    .leftJoin(
      userModules,
      and(eq(userModules.userId, users.id), eq(userModules.module, "tech_tools"), eq(userModules.level, "manage")),
    )
    .where(and(eq(users.isActive, true), or(eq(users.role, "admin"), sql`${userModules.id} is not null`)));
  return rows.map((r) => r.email);
}
