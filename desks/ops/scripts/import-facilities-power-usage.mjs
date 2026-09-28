#!/usr/bin/env node
// Historical seed of facilities_power_usage from the Facilities Master
// Sheet. Only "Receiving Units" has real data — spent/balance seed as null.
// Dry-run by default.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

const CSV_PATH = path.join(
  __dirname,
  "..",
  "data/sheet_import/facilities/csv/Power_Usage.csv",
);
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

function excelDateToIso(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function numOrNull(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function loadRows() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(2)) {
    const cols = parseCsvLine(line);
    const readingDate = excelDateToIso(cols[0]);
    if (!readingDate) continue;
    rows.push({
      school_id: USARIVER_SCHOOL_ID,
      reading_date: readingDate,
      units_received: numOrNull(cols[1]),
      units_spent: numOrNull(cols[2]),
      balance_units: numOrNull(cols[3]),
    });
  }
  return rows;
}

async function main() {
  const rows = loadRows();
  console.log(`Parsed ${rows.length} power usage readings from sheet export.`);

  if (!APPLY) {
    console.log("Dry run — pass --apply to write. Sample:");
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    console.log("...");
    console.log(JSON.stringify(rows.slice(-3), null, 2));
    return;
  }

  const { url, serviceKey } = loadEnv();
  const supabase = createClient(url, serviceKey);

  const { data: existing, error: existingErr } = await supabase
    .from("facilities_power_usage")
    .select("id, reading_date");
  if (existingErr) {
    console.error("Could not read facilities_power_usage — has schema_facilities.sql been run yet?");
    console.error(existingErr.message);
    process.exit(1);
  }
  const seen = new Set((existing ?? []).map((r) => r.reading_date));
  const toInsert = rows.filter((r) => !seen.has(r.reading_date));

  if (toInsert.length === 0) {
    console.log("Nothing new to insert — all rows already present.");
    return;
  }

  const { error: insertErr } = await supabase.from("facilities_power_usage").insert(toInsert);
  if (insertErr) {
    console.error("Insert failed:", insertErr.message);
    process.exit(1);
  }
  console.log(`Inserted ${toInsert.length} readings (skipped ${rows.length - toInsert.length} already present).`);
}

main();
