#!/usr/bin/env node
/**
 * Bulk-provision Driver app Auth logins and link profiles.driver_id.
 *
 * Usage:
 *   node scripts/provision-drivers.mjs --all-unlinked
 *   node scripts/provision-drivers.mjs --all-unlinked --shared-password 'TempPass123'
 *   node scripts/provision-drivers.mjs --csv path/to/drivers.csv
 *
 * CSV headers (flexible):
 *   driver_id,email
 *   or name,email  (matches fleet driver name, case-insensitive)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local loaded).
 * Only @silverleaf.co.tz emails are allowed.
 *
 * Prints a credentials table and writes driver-logins-<timestamp>.csv
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const DOMAIN = "silverleaf.co.tz";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

function slugPart(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.+/g, ".");
}

function suggestEmail(name) {
  return `${slugPart(name.trim()) || "driver"}@${DOMAIN}`;
}

function tempPassword(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = (data?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === target,
    );
    if (hit) return hit;
    if ((data?.users ?? []).length < 200) return null;
  }
  return null;
}

async function uniqueEmail(supabase, preferred, forDriverId) {
  const at = preferred.lastIndexOf("@");
  const local = preferred.slice(0, at);
  const domain = preferred.slice(at + 1);
  for (let n = 0; n < 50; n++) {
    const candidate =
      n === 0 ? preferred : `${local}.${n + 1}@${domain}`.toLowerCase();
    const existing = await findUserByEmail(supabase, candidate);
    if (!existing) return candidate;
    const { data: profile } = await supabase
      .from("profiles")
      .select("driver_id")
      .eq("id", existing.id)
      .maybeSingle();
    if (!profile?.driver_id || profile.driver_id === forDriverId) {
      return candidate;
    }
  }
  throw new Error(`No free email near ${preferred}`);
}

async function link(supabase, userId, driverId, fullName) {
  await supabase.from("profiles").update({ driver_id: null }).eq("driver_id", driverId);
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role: "driver",
      driver_id: driverId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function provisionOne(supabase, driver, emailIn, passwordMode, shared) {
  const preferred = (emailIn || suggestEmail(driver.name)).toLowerCase();
  if (!preferred.endsWith(`@${DOMAIN}`)) {
    return {
      driver_name: driver.name,
      email: preferred,
      action: "error",
      temporary_password: "",
      error: `Must be @${DOMAIN}`,
    };
  }
  const email = await uniqueEmail(supabase, preferred, driver.id);
  const existing = await findUserByEmail(supabase, email);

  if (existing) {
    let temporary = "";
    if (passwordMode === "shared" && shared) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: shared,
        email_confirm: true,
        user_metadata: { full_name: driver.name, role: "driver" },
      });
      if (error) throw error;
      temporary = shared;
    } else {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: { full_name: driver.name, role: "driver" },
      });
      if (error) throw error;
    }
    await link(supabase, existing.id, driver.id, driver.name);
    return {
      driver_name: driver.name,
      email,
      action: "linked",
      temporary_password: temporary,
      error: "",
    };
  }

  if (passwordMode === "none") {
    return {
      driver_name: driver.name,
      email,
      action: "error",
      temporary_password: "",
      error: "No Auth user — omit --link-only or set a password mode",
    };
  }

  const temporary =
    passwordMode === "shared" && shared ? shared : tempPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporary,
    email_confirm: true,
    user_metadata: { full_name: driver.name, role: "driver" },
  });
  if (error || !data?.user) throw error || new Error("createUser failed");
  await link(supabase, data.user.id, driver.id, driver.name);
  return {
    driver_name: driver.name,
    email,
    action: "created",
    temporary_password: temporary,
    error: "",
  };
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("id, name, active")
    .order("name");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { data: linkedProfiles } = await supabase
    .from("profiles")
    .select("driver_id")
    .not("driver_id", "is", null);
  const linkedIds = new Set(
    (linkedProfiles ?? []).map((p) => p.driver_id).filter(Boolean),
  );

  let passwordMode = "generate";
  if (args["link-only"]) passwordMode = "none";
  else if (args["shared-password"]) passwordMode = "shared";
  const shared = (args["shared-password"] || "").trim();

  /** @type {{ id: string, name: string, email?: string }[]} */
  let targets = [];

  if (args.csv) {
    const csvPath = resolve(process.cwd(), args.csv);
    const rows = parseCsv(readFileSync(csvPath, "utf8"));
    for (const row of rows) {
      const driverId = row.driver_id || row.id;
      const name = row.name || row.driver_name;
      const email = row.email || "";
      if (driverId) {
        const d = (drivers ?? []).find((x) => x.id === driverId);
        if (!d) {
          console.warn(`Skip unknown driver_id ${driverId}`);
          continue;
        }
        targets.push({ id: d.id, name: d.name, email });
      } else if (name) {
        const d = (drivers ?? []).find(
          (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );
        if (!d) {
          console.warn(`Skip unknown name ${name}`);
          continue;
        }
        targets.push({ id: d.id, name: d.name, email });
      }
    }
  } else if (args["all-unlinked"]) {
    targets = (drivers ?? [])
      .filter((d) => d.active && !linkedIds.has(d.id))
      .map((d) => ({ id: d.id, name: d.name }));
  } else {
    console.log(`Usage:
  node scripts/provision-drivers.mjs --all-unlinked
  node scripts/provision-drivers.mjs --all-unlinked --shared-password 'TempPass123'
  node scripts/provision-drivers.mjs --csv drivers.csv
  node scripts/provision-drivers.mjs --all-unlinked --link-only

CSV columns: driver_id,email  OR  name,email
`);
    process.exit(args.help ? 0 : 1);
  }

  console.log(`Provisioning ${targets.length} driver(s)…`);
  const results = [];
  for (const t of targets) {
    try {
      results.push(
        await provisionOne(
          supabase,
          { id: t.id, name: t.name },
          t.email,
          passwordMode,
          shared,
        ),
      );
    } catch (err) {
      results.push({
        driver_name: t.name,
        email: t.email || suggestEmail(t.name),
        action: "error",
        temporary_password: "",
        error: err.message ?? String(err),
      });
    }
  }

  console.log("\nResults:");
  for (const r of results) {
    console.log(
      `  ${r.driver_name} → ${r.email} [${r.action}]${
        r.temporary_password ? ` pw=${r.temporary_password}` : ""
      }${r.error ? ` ERR=${r.error}` : ""}`,
    );
  }

  const outPath = resolve(
    process.cwd(),
    `driver-logins-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
  );
  const csv = [
    "driver_name,email,temporary_password,action,error",
    ...results.map(
      (r) =>
        `"${r.driver_name}","${r.email}","${r.temporary_password}","${r.action}","${r.error}"`,
    ),
  ].join("\n");
  writeFileSync(outPath, csv, "utf8");
  console.log(`\nWrote ${outPath}`);
  console.log("Save passwords now — they are not stored in the database.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
