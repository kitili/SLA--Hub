#!/usr/bin/env node
// Historical seed of facilities_cctv from the Facilities Master Sheet.
// Skips the running-total rows at the bottom (no description, unlike
// every real row). Dry-run by default.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

const CSV_PATH = path.join(__dirname, "..", "data/sheet_import/facilities/csv/CCTV.csv");
const USARIVER_SCHOOL_ID = "a1000000-0000-4000-8000-000000000001";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const get = (k) =>
    env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim();
  return {
    url: get("NEXT_PUBLIC_SUPABASE_URL"),
    serviceKey: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadRows() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const rows = text.split(/\r?\n/).map(parseCsvLine);

  const out = [];
  let currentType = "";
  for (const cols of rows.slice(2)) {
    const typ = (cols[0] ?? "").trim();
    const location = (cols[1] ?? "").trim();
    const qty = (cols[2] ?? "").trim();
    const description = (cols[3] ?? "").trim();
    if (typ) currentType = typ;
    if (!location || !qty || !description) continue; // no description => running-total row
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      camera_type: currentType || null,
      location,
      quantity: Math.round(Number(qty)) || 1,
      description,
    });
  }
  return out;
}

async function main() {
  const rows = loadRows();
  console.log(`Parsed ${rows.length} camera entries from sheet export.`);

  if (!APPLY) {
    console.log("Dry run — pass --apply to write. Sample:");
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
    return;
  }

  const { url, serviceKey } = loadEnv();
  const supabase = createClient(url, serviceKey);

  const { data: existing, error: existingErr } = await supabase
    .from("facilities_cctv")
    .select("id, location, camera_type");
  if (existingErr) {
    console.error("Could not read facilities_cctv — has schema_facilities.sql been run yet?");
    console.error(existingErr.message);
    process.exit(1);
  }
  const seen = new Set((existing ?? []).map((r) => `${r.location}|${r.camera_type}`));
  const toInsert = rows.filter((r) => !seen.has(`${r.location}|${r.camera_type}`));

  if (toInsert.length === 0) {
    console.log("Nothing new to insert — all rows already present.");
    return;
  }

  const { error: insertErr } = await supabase.from("facilities_cctv").insert(toInsert);
  if (insertErr) {
    console.error("Insert failed:", insertErr.message);
    process.exit(1);
  }
  console.log(`Inserted ${toInsert.length} cameras (skipped ${rows.length - toInsert.length} already present).`);
}

main();
