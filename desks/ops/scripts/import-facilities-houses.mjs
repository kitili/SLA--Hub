#!/usr/bin/env node
// Historical seed of the 8 house definitions from the Facilities Master
// Sheet. Occupancy entries in the sheet have no year, so they're printed
// (not written) for manual entry via the UI. Dry-run by default.

import { createClient } from "@supabase/supabase-js";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";
ensureNodeWebSocket();
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

const CSV_PATH = path.join(
  __dirname,
  "..",
  "data/sheet_import/facilities/csv/Houses_Accomodation.csv",
);
const USARIVER_SCHOOL_ID = "a1000000-0000-4000-8000-000000000001";
const MONTHS = [
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

function loadData() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const rows = text.split(/\r?\n/).map(parseCsvLine);

  const houses = [];
  const ambiguousOccupancy = [];

  for (const cols of rows.slice(8, 17)) {
    const houseLetter = (cols[1] ?? "").trim();
    if (!houseLetter) continue;
    const houseName = (cols[2] ?? "").trim();
    const roomsDescription = (cols[3] ?? "").trim().replace(/\s+/g, " ") || null;
    const furnitureRaw = (cols[4] ?? "").trim().toLowerCase();
    const furnitureStatus = furnitureRaw === "furnished" ? "furnished" : "unfurnished";

    houses.push({
      school_id: USARIVER_SCHOOL_ID,
      house_letter: houseLetter,
      house_name: houseName,
      rooms_description: roomsDescription,
      furniture_status: furnitureStatus,
    });

    let col = 5;
    for (const month of MONTHS) {
      for (let w = 0; w < 4; w++) {
        const val = (cols[col + w] ?? "").trim();
        if (val) {
          ambiguousOccupancy.push({ house: `${houseLetter} (${houseName})`, month, week: w + 1, occupant: val });
        }
      }
      col += 4;
    }
  }

  return { houses, ambiguousOccupancy };
}

async function main() {
  const { houses, ambiguousOccupancy } = loadData();
  console.log(`Parsed ${houses.length} houses from sheet export.`);

  if (ambiguousOccupancy.length > 0) {
    console.log(
      `\n${ambiguousOccupancy.length} occupancy entries found but NOT seeded — no year given in the source sheet, so no date can be assigned without guessing. Enter these manually via the UI once the tables are live:`,
    );
    console.log(JSON.stringify(ambiguousOccupancy, null, 2));
  }

  if (!APPLY) {
    console.log("\nDry run — pass --apply to write. Sample:");
    console.log(JSON.stringify(houses.slice(0, 3), null, 2));
    return;
  }

  const { url, serviceKey } = loadEnv();
  const supabase = createClient(url, serviceKey);

  const { data: existing, error: existingErr } = await supabase
    .from("facilities_houses")
    .select("id, house_letter, house_name");
  if (existingErr) {
    console.error("Could not read facilities_houses — has schema_facilities.sql been run yet?");
    console.error(existingErr.message);
    process.exit(1);
  }
  const seen = new Set((existing ?? []).map((r) => `${r.house_letter}|${r.house_name}`));
  const toInsert = houses.filter((h) => !seen.has(`${h.house_letter}|${h.house_name}`));

  if (toInsert.length === 0) {
    console.log("Nothing new to insert — all houses already present.");
    return;
  }

  const { error: insertErr } = await supabase.from("facilities_houses").insert(toInsert);
  if (insertErr) {
    console.error("Insert failed:", insertErr.message);
    process.exit(1);
  }
  console.log(`Inserted ${toInsert.length} houses (skipped ${houses.length - toInsert.length} already present).`);
}

main();
