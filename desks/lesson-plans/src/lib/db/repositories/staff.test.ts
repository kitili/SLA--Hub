/**
 * Integration tests for the staff repository's upsertStaffByEmail policy,
 * against the in-memory PGlite that test/setup.ts migrates per worker.
 *
 * upsertStaffByEmail is the identity-critical register-or-touch entry point
 * for sign-in/registration, so its policy is pinned here:
 *   - a new email inserts a row with the email normalized (trimmed +
 *     lowercased);
 *   - an existing email touches `last_active_at` (no duplicate row);
 *   - `isAdmin: true` promotes a non-admin;
 *   - `isAdmin: false` NEVER demotes an existing admin (demotion is a separate,
 *     deliberate act via setAdmin).
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { staff } from "@/lib/db/schema";

import { upsertStaffByEmail } from "./staff";

let seq = 0;

/** A unique email per test so rows never collide across tests. */
function freshEmail(): string {
  seq += 1;
  return `staff-repo-${seq}-${Date.now()}@silverleaf.test`;
}

async function rowByEmail(email: string) {
  const rows = await db.select().from(staff).where(eq(staff.email, email));
  return rows[0];
}

describe("upsertStaffByEmail", () => {
  it("inserts a new row with the email normalized (trimmed + lowercased)", async () => {
    const email = freshEmail();
    const messy = `  ${email.toUpperCase()}  `;

    const result = await upsertStaffByEmail({
      email: messy,
      fullName: "  New Teacher  ",
      isAdmin: false,
    });

    expect(result.email).toBe(email);
    expect(result.fullName).toBe("New Teacher");
    expect(result.isAdmin).toBe(false);

    const persisted = await rowByEmail(email);
    expect(persisted).toBeDefined();
    expect(persisted!.id).toBe(result.id);
  });

  it("touches last_active_at for an existing email instead of inserting", async () => {
    const email = freshEmail();
    const first = await upsertStaffByEmail({
      email,
      fullName: "Returning Teacher",
      isAdmin: false,
    });

    // Backdate last_active_at so the touch is observable.
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db
      .update(staff)
      .set({ lastActiveAt: old })
      .where(eq(staff.id, first.id));

    const again = await upsertStaffByEmail({
      email,
      fullName: "Ignored On Touch",
      isAdmin: false,
    });

    // Same row (no duplicate insert), and both the returned row and the
    // persisted row reflect the touch.
    expect(again.id).toBe(first.id);
    expect(again.lastActiveAt.getTime()).toBeGreaterThan(old.getTime());

    const persisted = await rowByEmail(email);
    expect(persisted!.lastActiveAt.getTime()).toBeGreaterThan(old.getTime());

    const all = await db.select().from(staff).where(eq(staff.email, email));
    expect(all).toHaveLength(1);
  });

  it("promotes a non-admin when isAdmin: true is requested", async () => {
    const email = freshEmail();
    await upsertStaffByEmail({ email, fullName: "Teacher", isAdmin: false });

    const promoted = await upsertStaffByEmail({
      email,
      fullName: "Teacher",
      isAdmin: true,
    });

    expect(promoted.isAdmin).toBe(true);
    expect((await rowByEmail(email))!.isAdmin).toBe(true);
  });

  it("does NOT demote an existing admin when isAdmin: false is requested", async () => {
    const email = freshEmail();
    await upsertStaffByEmail({ email, fullName: "HR Admin", isAdmin: true });

    const still = await upsertStaffByEmail({
      email,
      fullName: "HR Admin",
      isAdmin: false,
    });

    expect(still.isAdmin).toBe(true);
    expect((await rowByEmail(email))!.isAdmin).toBe(true);
  });
});
