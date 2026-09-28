#!/usr/bin/env node
/**
 * Apply incident_alerts (two-step enum + tables) via psql.
 *
 *   node scripts/apply-incident-alerts.mjs
 *
 * Runs APPLY_INCIDENT_ALERTS_01_enum.sql then APPLY_INCIDENT_ALERTS.sql
 * as separate transactions (Postgres requires enum commit before use).
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const steps = [
  "supabase/APPLY_INCIDENT_ALERTS_01_enum.sql",
  "supabase/APPLY_INCIDENT_ALERTS.sql",
];

for (const file of steps) {
  const sqlFile = resolve(process.cwd(), file);
  const result = spawnSync(process.execPath, ["scripts/run-schema-sql.mjs", sqlFile], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
