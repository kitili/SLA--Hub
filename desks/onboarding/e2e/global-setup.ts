/**
 * Playwright global setup — runs once before the test suite (before webServer).
 *
 * In CI: resets PGlite, then captures seeded staff ids.
 * Locally with reuseExistingServer: only captures ids (do not reset while dev
 * server is running — that corrupts the embedded database).
 */
import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const env = { ...process.env, DATABASE_URL: "" };

  if (process.env.CI) {
    console.log("[e2e/global-setup] running db:reset …");
    execSync("npm run db:reset", { cwd: root, stdio: "inherit", env });
  }

  console.log("[e2e/global-setup] capturing seeded staff ids …");
  execSync(
    "npx tsx --conditions=react-server --import ./src/lib/db/scripts/ts-resolve.mjs ./e2e/capture-fixtures.ts",
    { cwd: root, stdio: "inherit", env },
  );

  console.log("[e2e/global-setup] DB ready.");
}
