import "server-only";

/**
 * Staff repository — typed data access for the `staff` table.
 *
 * Mirrors legacy `legacy/server/routes/staff.js`:
 *   - emails are always normalized (trimmed + lowercased) before lookup/insert
 *   - sign-in / registration touch `last_active_at`
 *   - the HR-admin promotion (`is_admin = TRUE`) is expressed as `setAdmin`
 *
 * Deliberately NO business policy here: deciding *whether* an email is an HR
 * admin depends on the `HR_ADMIN_EMAILS` env (owned by another module). Callers
 * pass that decision in as `isAdmin`. This keeps the data layer pure and free of
 * raw SQL leaking to callers.
 */
import { eq, ne } from "drizzle-orm";

import { namesAreSimilar, normalizePersonName } from "@/lib/email";
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

/** Other staff rows whose display name is the same or very similar. */
export async function findStaffWithSimilarName(
  fullName: string,
  exceptId?: string,
): Promise<Staff[]> {
  const needle = normalizePersonName(fullName);
  if (!needle) return [];
  const rows = exceptId
    ? await db.select().from(staff).where(ne(staff.id, exceptId))
    : await db.select().from(staff);
  return rows.filter(
    (row) => Boolean(normalizePersonName(row.fullName)) && namesAreSimilar(row.fullName, fullName),
  );
}

/** Emails already claimed — used to suggest a free firstname.lastname@silverleaf.co.tz. */
export async function listStaffEmails(): Promise<string[]> {
  const rows = await db.select({ email: staff.email }).from(staff);
  return rows.map((row) => row.email);
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

/** Move a staff row to a unique work email. Fails if that email is taken. */
export async function updateStaffEmail(
  id: string,
  email: string,
): Promise<Staff | undefined> {
  const normalized = normalizeEmail(email);
  const taken = await findStaffByEmail(normalized);
  if (taken && taken.id !== id) return undefined;
  const rows = await db
    .update(staff)
    .set({ email: normalized, lastActiveAt: new Date() })
    .where(eq(staff.id, id))
    .returning();
  return rows[0];
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

/** Store or replace the password hash used for admin sign-in. */
export async function setAdminPasswordHash(
  id: string,
  adminPasswordHash: string,
): Promise<Staff | undefined> {
  const rows = await db
    .update(staff)
    .set({ adminPasswordHash })
    .where(eq(staff.id, id))
    .returning();
  return rows[0];
}

export interface CreateStaffInput {
  email: string;
  fullName: string;
  campus?: string | null;
  jobTitle?: string | null;
  edAdminStaffId?: string | null;
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
      edAdminStaffId: input.edAdminStaffId ?? null,
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

async function syncStaffProfile(
  existing: Staff,
  input: UpsertStaffInput,
): Promise<Staff> {
  const fullName = input.fullName?.trim();
  const jobTitle = input.jobTitle?.trim() ?? null;
  const edAdminStaffId = input.edAdminStaffId?.trim() ?? null;
  const updates: {
    fullName?: string;
    jobTitle?: string | null;
    edAdminStaffId?: string | null;
    lastActiveAt: Date;
    isAdmin?: boolean;
  } = { lastActiveAt: new Date() };

  if (fullName && fullName !== existing.fullName) updates.fullName = fullName;
  if (jobTitle && jobTitle !== existing.jobTitle) updates.jobTitle = jobTitle;
  if (
    edAdminStaffId &&
    edAdminStaffId !== existing.edAdminStaffId
  ) {
    updates.edAdminStaffId = edAdminStaffId;
  }
  if (input.isAdmin && !existing.isAdmin) updates.isAdmin = true;

  if (
    updates.fullName === undefined &&
    updates.jobTitle === undefined &&
    updates.edAdminStaffId === undefined &&
    updates.isAdmin === undefined
  ) {
    await touchLastActive(existing.id);
    return { ...existing, lastActiveAt: new Date() };
  }

  const rows = await db
    .update(staff)
    .set(updates)
    .where(eq(staff.id, existing.id))
    .returning();
  return rows[0] ?? { ...existing, lastActiveAt: new Date() };
}

/**
 * Register-or-touch, mirroring the legacy `/register` + `/signin` flow:
 *   - if a staff row exists for the email → refresh profile fields from ed-admin,
 *     touch `last_active_at`, ensure the admin flag is at least the requested
 *     value, and return the row (progress tables are never touched here).
 *   - otherwise → insert a new row.
 *
 * Idempotent on email (the unique business key).
 */
export async function upsertStaffByEmail(
  input: UpsertStaffInput,
): Promise<Staff> {
  const existing = await findStaffByEmail(input.email);

  if (existing) {
    return syncStaffProfile(existing, input);
  }

  return createStaff(input);
}
