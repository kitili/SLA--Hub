#!/usr/bin/env node
/**
 * Set one staff member's profiles.role to match another's.
 *
 * Usage:
 *   node scripts/match-staff-role.mjs --from baraka@silverleaf.co.tz --to intern-shikunzi@silverleaf.co.tz
 *
 * Reads the "from" user's current role via the Admin API and applies it to
 * the "to" user's profiles row. Never touches Auth (email/password) — only
 * the role column.
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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const fromEmail = args.from;
  const toEmail = args.to;
  if (!fromEmail || !toEmail) {
    console.error("Usage: node scripts/match-staff-role.mjs --from <email> --to <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fromUser = await findUserByEmail(supabase, fromEmail);
  if (!fromUser) {
    console.error(`No auth user found for ${fromEmail}`);
    process.exit(1);
  }
  const toUser = await findUserByEmail(supabase, toEmail);
  if (!toUser) {
    console.error(`No auth user found for ${toEmail}`);
    process.exit(1);
  }

  const { data: fromProfile, error: fromErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", fromUser.id)
    .single();
  if (fromErr || !fromProfile) {
    console.error(`Could not read profile for ${fromEmail}:`, fromErr?.message);
    process.exit(1);
  }

  const { data: toProfileBefore } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", toUser.id)
    .single();

  console.log(`${fromEmail} role: ${fromProfile.role}`);
  console.log(`${toEmail} role (before): ${toProfileBefore?.role ?? "(no profile row)"}`);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ role: fromProfile.role, updated_at: new Date().toISOString() })
    .eq("id", toUser.id);
  if (updateErr) {
    console.error(`Failed to update ${toEmail}:`, updateErr.message);
    process.exit(1);
  }

  console.log(`${toEmail} role (after): ${fromProfile.role}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
