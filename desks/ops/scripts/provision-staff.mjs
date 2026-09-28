#!/usr/bin/env node
/**
 * Idempotent staff provisioning for Supabase Auth + public.profiles.
 *
 * Usage:
 *   node scripts/provision-staff.mjs
 *   node scripts/provision-staff.mjs --slt-password 'slt2026'
 *
 * Env (from .env.local or process):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STAFF_SLT_PASSWORD       (or --slt-password) — super admin
 *   STAFF_ADMIN_PASSWORD     (legacy alias for STAFF_SLT_PASSWORD)
 *   STAFF_MATRON_PASSWORD
 *   STAFF_BARAKA_PASSWORD    (admin)
 *   STAFF_SHIKUNZI_PASSWORD  (admin)
 *   STAFF_KUSADUKA_PASSWORD  (ops_manager: kitchen/facilities/farm)
 *   STAFF_FRANCIS_PASSWORD   (admin)
 *   STAFF_FINANCE_PASSWORD / STAFF_DRIVER_PASSWORD / STAFF_FARM_PASSWORD (optional)
 *
 * Never commit passwords. See docs/STAFF_USERS.md.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const ALLOWED_DOMAIN = "silverleaf.co.tz";

const DEFAULT_STAFF = [
  {
    email: "slt@silverleaf.co.tz",
    role: "admin",
    fullName: "SLT",
    passwordEnv: "STAFF_SLT_PASSWORD",
    passwordArg: "slt-password",
    // Accept legacy env name used when Baraka was the only admin.
    passwordEnvAlt: "STAFF_ADMIN_PASSWORD",
    passwordArgAlt: "admin-password",
  },
  {
    email: "baraka@silverleaf.co.tz",
    role: "admin",
    fullName: "Baraka",
    passwordEnv: "STAFF_BARAKA_PASSWORD",
    passwordArg: "baraka-password",
    // Keep working if only the old admin password is set.
    passwordEnvAlt: "STAFF_ADMIN_PASSWORD",
    passwordArgAlt: "admin-password",
  },
  {
    email: "francis@silverleaf.co.tz",
    role: "admin",
    fullName: "Francis",
    passwordEnv: "STAFF_FRANCIS_PASSWORD",
    passwordArg: "francis-password",
  },
  {
    email: "intern-shikunzi@silverleaf.co.tz",
    role: "admin",
    fullName: "Shikunzi",
    passwordEnv: "STAFF_SHIKUNZI_PASSWORD",
    passwordArg: "shikunzi-password",
  },
  {
    email: "kusaduka@silverleaf.co.tz",
    role: "ops_manager",
    fullName: "Kusaduka",
    passwordEnv: "STAFF_KUSADUKA_PASSWORD",
    passwordArg: "kusaduka-password",
  },
  {
    email: "matron@silverleaf.co.tz",
    role: "matron",
    fullName: "Matron",
    passwordEnv: "STAFF_MATRON_PASSWORD",
    passwordArg: "matron-password",
  },
  {
    email: "finance@silverleaf.co.tz",
    role: "finance",
    fullName: "Finance",
    passwordEnv: "STAFF_FINANCE_PASSWORD",
    passwordArg: "finance-password",
    optional: true,
  },
  {
    email: "driver@silverleaf.co.tz",
    role: "driver",
    fullName: "Driver",
    passwordEnv: "STAFF_DRIVER_PASSWORD",
    passwordArg: "driver-password",
    optional: true,
  },
  {
    email: "farm@silverleaf.co.tz",
    role: "farm",
    fullName: "Farm",
    passwordEnv: "STAFF_FARM_PASSWORD",
    passwordArg: "farm-password",
    optional: true,
  },
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

function passwordFor(staff, args) {
  return (
    args[staff.passwordArg] ||
    (staff.passwordArgAlt ? args[staff.passwordArgAlt] : "") ||
    process.env[staff.passwordEnv] ||
    (staff.passwordEnvAlt ? process.env[staff.passwordEnvAlt] : "") ||
    ""
  ).trim();
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function upsertProfile(supabase, userId, { fullName, role }) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function provisionOne(supabase, staff, password) {
  const existing = await findUserByEmail(supabase, staff.email);
  let userId;

  if (existing) {
    userId = existing.id;
    const patch = {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: staff.fullName,
        role: staff.role,
      },
    };
    if (password) patch.password = password;
    const { error } = await supabase.auth.admin.updateUserById(userId, patch);
    if (error) throw error;
    await upsertProfile(supabase, userId, {
      fullName: staff.fullName,
      role: staff.role,
    });
    return {
      email: staff.email,
      role: staff.role,
      action: password ? "updated (password + profile)" : "updated (profile only)",
      userId,
    };
  }

  if (!password) {
    return {
      email: staff.email,
      role: staff.role,
      action: "skipped — no password (set env or --arg)",
      userId: null,
    };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: staff.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: staff.fullName,
      role: staff.role,
    },
  });
  if (error) throw error;
  userId = data.user.id;
  await upsertProfile(supabase, userId, {
    fullName: staff.fullName,
    role: staff.role,
  });
  return {
    email: staff.email,
    role: staff.role,
    action: "created",
    userId,
  };
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Copy .env.example → .env.local and fill service role key (never commit).",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  let missingRequiredPassword = false;

  for (const staff of DEFAULT_STAFF) {
    if (!staff.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      console.error(`Refusing non-@${ALLOWED_DOMAIN} email: ${staff.email}`);
      process.exit(1);
    }

    const password = passwordFor(staff, args);
    if (!password && !staff.optional) {
      missingRequiredPassword = true;
    }
    if (!password && staff.optional) {
      results.push({
        email: staff.email,
        role: staff.role,
        action: "skipped (optional — no password)",
        userId: null,
      });
      continue;
    }

    try {
      results.push(await provisionOne(supabase, staff, password));
    } catch (err) {
      console.error(`Failed for ${staff.email}:`, err.message ?? err);
      process.exitCode = 1;
      results.push({
        email: staff.email,
        role: staff.role,
        action: `error: ${err.message ?? err}`,
        userId: null,
      });
    }
  }

  console.log("\nStaff provisioning results:");
  for (const r of results) {
    console.log(`  ${r.email} → ${r.role}: ${r.action}${r.userId ? ` (${r.userId})` : ""}`);
  }

  if (missingRequiredPassword) {
    console.log(`
Passwords missing for required staff. Set in .env.local (do not commit):

  STAFF_SLT_PASSWORD=slt2026
  STAFF_MATRON_PASSWORD=…
  STAFF_BARAKA_PASSWORD=…
  STAFF_SHIKUNZI_PASSWORD=…
  STAFF_KUSADUKA_PASSWORD=…

Or pass once:

  node scripts/provision-staff.mjs \\
    --slt-password 'slt2026' \\
    --matron-password '…' \\
    --baraka-password '…' \\
    --shikunzi-password '…' \\
    --kusaduka-password '…'

See docs/STAFF_USERS.md.
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
