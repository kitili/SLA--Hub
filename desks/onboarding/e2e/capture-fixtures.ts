/**
 * Read seeded demo staff ids from the active DB and write e2e fixture files.
 * Used by global-setup after the dev server (and db:reset) has run.
 */
import { findStaffByEmail } from "../src/lib/db/repositories/staff";

import { writeAdminFixture, writeNonAdminFixture } from "./auth-helpers";

async function main(): Promise<void> {
  const [teacher, hr] = await Promise.all([
    findStaffByEmail("teacher@silverleaf.co.tz"),
    findStaffByEmail("hr@silverleaf.co.tz"),
  ]);

  if (!teacher) {
    throw new Error(
      "[e2e/capture-fixtures] teacher@silverleaf.co.tz not found — run db:seed",
    );
  }
  if (!hr) {
    throw new Error(
      "[e2e/capture-fixtures] hr@silverleaf.co.tz not found — run db:seed",
    );
  }

  writeNonAdminFixture(teacher.id);
  writeAdminFixture(hr.id);
  console.log(`[e2e/capture-fixtures] non-admin ${teacher.id}`);
  console.log(`[e2e/capture-fixtures] admin ${hr.id}`);
}

main().catch((err: unknown) => {
  console.error("[e2e/capture-fixtures] failed:", err);
  process.exit(1);
});
