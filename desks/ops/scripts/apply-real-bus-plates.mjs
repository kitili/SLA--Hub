#!/usr/bin/env node
/**
 * Apply the real bus plate updates -- all 20 of 20 buses now confirmed once
 * you count the 3 already-real T910 APW / T326 EBP / T108 DYW (left
 * untouched) -- directly via the Supabase service role. Kai verbally
 * approved applying this ourselves rather than waiting. Also fills in
 * attendant_name where a previously-unknown one was confirmed (Boma).
 *
 * Same env-loading pattern as scripts/import-student-coordinates.mjs.
 *
 * Usage:
 *   node scripts/apply-real-bus-plates.mjs          (dry run -- prints only)
 *   node scripts/apply-real-bus-plates.mjs --apply  (writes)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const UPDATES = [
  { label: "CPP", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T226 CPP" },
  { label: "Coaster BAE - Young boys", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T585 BAE" },
  { label: "DDA", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T483 DDA" },
  { label: "Rental Hiace", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T452 DWX" },
  { label: "BAE", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T585 BAE" },
  { label: "BHM", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T236 BHM" },
  { label: "DSD", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T177 DSD" },
  { label: "Rental Coaster BUF) - Nkoaranga", school_id: "a1000000-0000-4000-8000-000000000001", plate: "T954 BUF" },
  { label: "Coaster  CHE", school_id: "a1000000-0000-4000-8000-000000000002", plate: "T199 CHE" },
  { label: "Hiace EBM", school_id: "a1000000-0000-4000-8000-000000000002", plate: "T418 EBM" },
  { label: "Hiace DKS", school_id: "a1000000-0000-4000-8000-000000000002", plate: "T348 DKS" },
  { label: "Rental Hiace", school_id: "a1000000-0000-4000-8000-000000000002", plate: "T400 BMC" },
  { label: "HIACE - Normal route", school_id: "a1000000-0000-4000-8000-000000000003", plate: "T215 DAU" },
  { label: "Hiaace DKS - Back up", school_id: "a1000000-0000-4000-8000-000000000003", plate: "T348 DKS" },
  { label: "HIACE - Normal route", school_id: "a1000000-0000-4000-8000-000000000004", plate: "T814 DVA" },
  { label: "Coasster CHE - Back up", school_id: "a1000000-0000-4000-8000-000000000004", plate: "T199 CHE" },
  // Boma's only bus -- last plate confirmed, plus a previously-unknown attendant name.
  { label: "HIACE", school_id: "a1000000-0000-4000-8000-000000000005", plate: "T246 CGL", attendant_name: "Angela Emanuel" },
];

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let ok = 0;
  let noMatch = 0;
  let failed = 0;

  for (const u of UPDATES) {
    const { data: before } = await supabase
      .from("buses")
      .select("id, label, plate_number, attendant_name")
      .eq("label", u.label)
      .eq("school_id", u.school_id)
      .maybeSingle();

    if (!before) {
      console.log(`  NO MATCH: label=${u.label} school_id=${u.school_id}`);
      noMatch++;
      continue;
    }

    const patch = { plate_number: u.plate };
    if (u.attendant_name) patch.attendant_name = u.attendant_name;

    if (!apply) {
      const extra = u.attendant_name ? `, attendant ${before.attendant_name ?? "null"} -> ${u.attendant_name}` : "";
      console.log(`  [dry-run] would set ${before.label} (${before.plate_number} -> ${u.plate}${extra})`);
      continue;
    }

    const { error } = await supabase
      .from("buses")
      .update(patch)
      .eq("id", before.id);

    if (error) {
      console.log(`  FAILED ${before.label}: ${error.message}`);
      failed++;
    } else {
      console.log(`  OK ${before.label}: ${before.plate_number} -> ${u.plate}`);
      ok++;
    }
  }

  if (!apply) {
    console.log(`\nDry run only -- pass --apply to write ${UPDATES.length - noMatch} updates.`);
  } else {
    console.log(`\nDone. ${ok} updated, ${noMatch} no-match, ${failed} failed.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
