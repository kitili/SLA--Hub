#!/usr/bin/env node
/**
 * Full-database export via the Supabase REST API, independent of Supabase's
 * own backup/PITR settings (which need a paid plan + Kai's project access to
 * configure). Dumps every row of every table below to timestamped JSON files
 * under backups/<timestamp>/ -- gitignored, never committed (real student/
 * parent PII).
 *
 * This exists because the 2026-08-01 seed_silverleaf.sql wipe left several
 * things genuinely unrecoverable (incidents, trip/boarding history) with no
 * static source to rebuild from. Run this before any risky schema/seed
 * operation, and ideally on a regular cadence too.
 *
 * Usage:
 *   node scripts/backup-database.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Every table currently known to exist in this app's schema. Tables that
// don't exist yet (e.g. "drivers" before schema_drivers.sql is run) are
// skipped with a warning, not treated as a fatal error.
const TABLES = [
  "schools",
  "profiles",
  "buses",
  "drivers",
  "students",
  "parents",
  "student_parents",
  "qr_codes",
  "fee_balances",
  "fee_sync_runs",
  "routes",
  "stops",
  "route_stops",
  "student_stop_assignments",
  "trips",
  "boarding_events",
  "trip_locations",
  "incidents",
  "maintenance_records",
  "expenses",
  "revenues",
  "budgets",
  "hire_outs",
  "message_logs",
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dir = resolve(process.cwd(), "backups", timestamp());
  mkdirSync(dir, { recursive: true });
  console.log(`Backing up to ${dir}\n`);

  const summary = [];
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.log(`  SKIP ${table} — ${error.message}`);
      summary.push({ table, rows: null, error: error.message });
      continue;
    }
    writeFileSync(
      resolve(dir, `${table}.json`),
      JSON.stringify(data, null, 2),
      "utf8",
    );
    console.log(`  OK   ${table} — ${data.length} row(s)`);
    summary.push({ table, rows: data.length });
  }

  writeFileSync(
    resolve(dir, "_summary.json"),
    JSON.stringify({ takenAt: new Date().toISOString(), summary }, null, 2),
    "utf8",
  );

  const failed = summary.filter((s) => s.error);
  console.log(`\nDone. ${summary.length - failed.length}/${summary.length} tables backed up.`);
  if (failed.length > 0) {
    console.log(`Skipped (table doesn't exist yet, or another error): ${failed.map((s) => s.table).join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
