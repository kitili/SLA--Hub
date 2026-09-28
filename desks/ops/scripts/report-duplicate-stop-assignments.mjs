#!/usr/bin/env node
/**
 * Read-only report: active students with more than one row in
 * student_stop_assignments, and whether each of their route_ids still
 * matches a route an active bus actually serves.
 *
 * Written after fixing assignStudentToStop() to stop creating new
 * duplicates going forward -- this is for cleaning up rows that already
 * exist from before that fix. Prints only; makes no changes.
 *
 * Usage: node scripts/report-duplicate-stop-assignments.mjs
 *
 * Env (from .env.local or process):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

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
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: buses, error: busesErr } = await supabase
  .from("buses")
  .select("id, label, route_id, active");
if (busesErr) {
  console.error("Failed to read buses:", busesErr.message);
  process.exit(1);
}

const { data: assignments, error: assignErr } = await supabase
  .from("student_stop_assignments")
  .select("student_id, stop_id, route_id, students ( first_name, last_name ), stops ( name )");
if (assignErr) {
  console.error("Failed to read student_stop_assignments:", assignErr.message);
  process.exit(1);
}

const activeRouteToBuses = new Map();
for (const b of buses ?? []) {
  if (!b.active || !b.route_id) continue;
  if (!activeRouteToBuses.has(b.route_id)) activeRouteToBuses.set(b.route_id, []);
  activeRouteToBuses.get(b.route_id).push(b.label);
}

const byStudent = new Map();
for (const a of assignments ?? []) {
  if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, []);
  byStudent.get(a.student_id).push(a);
}

const duplicated = [...byStudent.entries()].filter(([, rows]) => rows.length > 1);

console.log(`Total student_stop_assignments rows: ${assignments?.length ?? 0}`);
console.log(`Students with more than one assignment row: ${duplicated.length}\n`);

for (const [, rows] of duplicated) {
  const student = rows[0].students
    ? (Array.isArray(rows[0].students) ? rows[0].students[0] : rows[0].students)
    : null;
  const name = student ? `${student.first_name} ${student.last_name}` : rows[0].student_id;
  console.log(`${name}:`);
  for (const r of rows) {
    const stop = r.stops ? (Array.isArray(r.stops) ? r.stops[0] : r.stops) : null;
    const servedBy = r.route_id ? activeRouteToBuses.get(r.route_id) : null;
    const status = !r.route_id
      ? "no route_id set"
      : servedBy?.length
        ? `served by active bus: ${servedBy.join(", ")}`
        : "route_id matches NO currently active bus — likely the stale one";
    console.log(`  - stop "${stop?.name ?? r.stop_id}", route ${r.route_id ?? "(none)"} — ${status}`);
  }
  console.log("");
}
