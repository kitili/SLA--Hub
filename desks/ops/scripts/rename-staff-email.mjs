#!/usr/bin/env node
/**
 * One-off: change an existing staff member's login email without creating a
 * duplicate account. provision-staff.mjs looks up accounts BY email, so
 * editing the email there only ever creates a new account — it can't rename
 * an existing one. This does the actual rename via the Admin API.
 *
 * Usage:
 *   node scripts/rename-staff-email.mjs old@silverleaf.co.tz new@silverleaf.co.tz
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

  const [oldEmail, newEmail] = process.argv.slice(2);
  if (!oldEmail || !newEmail) {
    console.error("Usage: node scripts/rename-staff-email.mjs old@silverleaf.co.tz new@silverleaf.co.tz");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Copy .env.example → .env.local and fill in the service role key (never commit it).",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await findUserByEmail(supabase, oldEmail);
  if (!user) {
    console.error(`No account found with email ${oldEmail} — nothing to rename.`);
    process.exit(1);
  }

  const existingWithNewEmail = await findUserByEmail(supabase, newEmail);
  if (existingWithNewEmail) {
    console.error(`${newEmail} is already in use by another account (${existingWithNewEmail.id}) — aborting.`);
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
  });
  if (error) {
    console.error("Rename failed:", error.message);
    process.exit(1);
  }

  console.log(`Renamed ${oldEmail} -> ${newEmail} (user ${data.user.id}). Profile role and password are unchanged.`);
}

main();
