#!/usr/bin/env node
/**
 * One-time backfill: create a public.drivers row for every distinct real
 * driver_name currently on public.buses, then link each bus's driver_id.
 *
 * "New Driver" (the DDA bus's placeholder, not a real name) is deliberately
 * skipped -- that bus is left with driver_id = null for someone to fill in
 * with a real name later.
 *
 * Requires supabase/schema_drivers.sql to already be applied (run it in the
 * Supabase SQL Editor first, then reload the PostgREST schema cache).
 *
 * Dry-run by default — prints the name/bus mapping only, writes nothing.
 * Pass --apply to actually write.
 *
 * Usage:
 *   node scripts/apply-driver-migration.mjs
 *   node scripts/apply-driver-migration.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PLACEHOLDER_NAMES = new Set(["new driver"]);

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
  return { apply: argv.includes("--apply") };
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

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

  const { data: buses, error: busesErr } = await supabase
    .from("buses")
    .select("id, label, school_id, driver_name, driver_id");
  if (busesErr) throw busesErr;

  const byName = new Map();
  for (const bus of buses) {
    const name = (bus.driver_name ?? "").trim();
    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) continue;
    if (bus.driver_id) continue; // already linked, skip
    const list = byName.get(name) ?? [];
    list.push(bus);
    byName.set(name, list);
  }

  const distinctNames = [...byName.keys()].sort();
  console.log(`Found ${distinctNames.length} distinct unlinked driver name(s):`);
  for (const name of distinctNames) {
    const buses = byName.get(name);
    console.log(
      `  - "${name}" -> ${buses.length} bus(es): ${buses.map((b) => b.label).join(", ")}`,
    );
  }
  const skipped = buses.filter(
    (b) => (b.driver_name ?? "").trim().toLowerCase() === "new driver",
  );
  if (skipped.length > 0) {
    console.log(
      `\nSkipped (placeholder, not a real name): ${skipped.map((b) => b.label).join(", ")}`,
    );
  }

  if (!args.apply) {
    console.log(`\nDry run only — pass --apply to create ${distinctNames.length} driver(s) and link them.`);
    return;
  }

  console.log(`\nCreating ${distinctNames.length} driver(s)...`);
  let ok = 0;
  let failed = 0;
  for (const name of distinctNames) {
    const { data: driver, error: insertErr } = await supabase
      .from("drivers")
      .insert({ name })
      .select("id")
      .single();
    if (insertErr || !driver) {
      console.log(`  FAILED to create driver "${name}": ${insertErr?.message}`);
      failed++;
      continue;
    }

    const busesForName = byName.get(name);
    const { error: updateErr } = await supabase
      .from("buses")
      .update({ driver_id: driver.id })
      .in(
        "id",
        busesForName.map((b) => b.id),
      );
    if (updateErr) {
      console.log(`  FAILED to link buses for "${name}": ${updateErr.message}`);
      failed++;
      continue;
    }
    ok++;
  }
  console.log(`\nDone. ${ok} driver(s) created and linked, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
