import "server-only";

/**
 * Staff repository — typed data access for the `staff` table.
 *
 * Mirrors the pre-Next Express app's staff route semantics (that app is no
 * longer in this repo):
 *   - emails are always normalized (trimmed + lowercased) before lookup/insert
 *   - sign-in / registration touch `last_active_at`
 *   - the HR-admin promotion (`is_admin = TRUE`) is expressed as `setAdmin`
 *
 * Deliberately NO business policy here: deciding *whether* an email is an HR
 * admin depends on the `HR_ADMIN_EMAILS` env (owned by another module). Callers
 * pass that decision in as `isAdmin`. This keeps the data layer pure and free of
 * raw SQL leaking to callers.
 */
import { eq } from "drizzle-orm";

import { db } from "../client";
import { staff, type Staff } from "../schema";

/** Normalize an email the same way the legacy server did. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Find a staff member by (normalized) email, or `undefined`. */
export async function findStaffByEmail(
  email: string,
): Promise<Staff | undefined> {
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.email, normalizeEmail(email)))
    .limit(1);
  return rows[0];
}

/** Find a staff member by id, or `undefined`. */
export async function findStaffById(id: string): Promise<Staff | undefined> {
  const rows = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return rows[0];
}

/** Update `last_active_at = now()` for a staff id. No-op if id is unknown. */
export async function touchLastActive(id: string): Promise<void> {
  await db
    .update(staff)
    .set({ lastActiveAt: new Date() })
    .where(eq(staff.id, id));
}

/** Set the admin flag for a staff id and return the updated row. */
export async function setAdmin(
  id: string,
  isAdmin: boolean,
): Promise<Staff | undefined> {
  const rows = await db
    .update(staff)
    .set({ isAdmin })
    .where(eq(staff.id, id))
    .returning();
  return rows[0];
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  campus?: string | null;
  jobTitle?: string | null;
  isAdmin?: boolean;
}

/** Insert a new staff row (email normalized) and return it. */
export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  const rows = await db
    .insert(staff)
    .values({
      email: normalizeEmail(input.email),
      fullName: input.fullName.trim(),
      campus: input.campus ?? null,
      jobTitle: input.jobTitle ?? null,
      isAdmin: input.isAdmin ?? false,
    })
    .returning();
  // `.returning()` always yields the inserted row.
  return rows[0]!;
}

export interface UpsertStaffInput extends CreateStaffInput {
  /** Admin decision computed by the caller from HR_ADMIN_EMAILS. */
  isAdmin: boolean;
}

/**
 * Register-or-touch, mirroring the legacy `/register` + `/signin` flow:
 *   - if a staff row exists for the email → touch `last_active_at`, ensure the
 *     admin flag is at least the requested value, and return the row.
 *   - otherwise → insert a new row.
 *
 * Idempotent on email (the unique business key).
 */
export async function upsertStaffByEmail(
  input: UpsertStaffInput,
): Promise<Staff> {
  const existing = await findStaffByEmail(input.email);

  if (existing) {
    await touchLastActive(existing.id);
    // Promote to admin if required, but never demote here.
    if (input.isAdmin && !existing.isAdmin) {
      const promoted = await setAdmin(existing.id, true);
      if (promoted) return promoted;
    }
    return { ...existing, lastActiveAt: new Date() };
  }

  return createStaff(input);
}
