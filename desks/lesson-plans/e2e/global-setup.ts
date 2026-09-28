/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Applies DB migrations and seeds the dev PGlite database so that:
 *   - the sample lesson plans and prompt parts exist
 *   - demo staff rows (hr@, teacher@) exist
 *
 * The dev server is started BEFORE this file by Playwright's webServer config,
 * but globalSetup itself is invoked BEFORE any tests, and after the server is
 * ready (because globalSetup and webServer are both awaited by Playwright in
 * the correct order when reuseExistingServer is true in dev).
 */
import { execSync } from "child_process";
import path from "path";

import { writeAdminFixture, writeNonAdminFixture } from "./auth-helpers";

export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");

  console.log("[e2e/global-setup] running db:migrate …");
  execSync("npm run db:migrate", { cwd: root, stdio: "inherit" });

  console.log("[e2e/global-setup] running db:seed …");
  // Capture stdout so we can recover the seeded non-admin (teacher) staff id,
  // which the admin-gate spec needs to forge a non-admin session cookie. The
  // id is a DB-generated UUID, so it can't be hardcoded — but db:seed logs it.
  const seedOut = execSync("npm run db:seed", { cwd: root, encoding: "utf8" });
  process.stdout.write(seedOut);

  const match = seedOut.match(
    /upserted\s+teacher@silverleaf\.co\.tz\s+\(([0-9a-fA-F-]+)\)/,
  );
  if (!match) {
    throw new Error(
      "[e2e/global-setup] could not parse seeded teacher staff id from db:seed output",
    );
  }
  writeNonAdminFixture(match[1]!);
  console.log(`[e2e/global-setup] captured non-admin staff id ${match[1]}`);

  // Also capture the seeded HR-admin (hr@) id, so specs that need an *admin*
  // session (the mobile-responsive sweep over /admin routes) can forge one.
  const adminMatch = seedOut.match(
    /upserted\s+hr@silverleaf\.co\.tz\s+\(([0-9a-fA-F-]+)\)/,
  );
  if (!adminMatch) {
    throw new Error(
      "[e2e/global-setup] could not parse seeded hr-admin staff id from db:seed output",
    );
  }
  writeAdminFixture(adminMatch[1]!);
  console.log(`[e2e/global-setup] captured admin staff id ${adminMatch[1]}`);

  console.log("[e2e/global-setup] DB ready.");
}
