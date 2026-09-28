#!/usr/bin/env node
/**
 * Verifies the newly-imported 2024/2025 historical headcount lines and
 * ingredient prices (see import-kitchens-master-2026.mjs) against each
 * source tab's own numbers. Read-only -- makes no writes.
 *
 * Usage: node scripts/verify-usa-river-historical-import.mjs [path-to-xlsx]
 *
 * IMPORTANT -- this does NOT recompute "estimated ingredient cost" (the
 * Procurement page's Computed Requirements panel) for historical months,
 * and deliberately so: kitchen_ingredient_campus_settings (people_per_kg /
 * kg_per_week / weeks_in_month) has no time dimension in the schema -- it's
 * a single current row per school+ingredient, always reflecting whichever
 * sheet was imported last (2026, since it sorts after 2024/2025). Checked
 * directly against the source: January 2024's own ratio block used THREE
 * separate ratios (Day / Boarding-weekday / Boarding-weekend) and a 4-week
 * month, versus the single blended ratio and 3.5-week month now stored --
 * these are genuinely different models, not an import bug. Comparing
 * "recomputed ingredient cost" for a historical month would silently apply
 * 2026's ratios to 2024's headcount and produce a meaningless number (confirmed
 * this first: it inflated every 2024 month's total by ~2x). Fixing that
 * would need a real schema change (versioned ratios) -- out of scope here.
 *
 * What IS safely time-series and worth checking: kitchen_headcount_lines
 * (has its own `month` column) and kitchen_ingredient_prices (has its own
 * `effective_date` column). This script checks both directly against the
 * source tab, without going through the ratio-dependent cost model at all.
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_FILE = "/home/kiki/Downloads/2026 Kitchens Master Sheet.xlsx";
const USA_RIVER_ID = "a1000000-0000-4000-8000-000000000001";
const MONTHS_2024 = [
  "January 2024",
  "February 2024",
  "March 2024",
  "April 2024",
  "May 2024",
  "June 2024",
  "July 2024",
  "August 2024",
];

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const split = trimmed.indexOf("=");
    if (split < 1) continue;
    const key = trimmed.slice(0, split).trim();
    let value = trimmed.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function monthStart(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function string(v) {
  return v == null ? "" : String(v).trim();
}

/** DETAIL block's own TOTAL row, col E (index 4) -- sum of headcount x days
 * x price_per_person across every category. Ratio-independent, so this is
 * a clean way to check the headcount import without touching ingredients. */
function sheetDetailTotal(rows) {
  for (let r = 0; r < rows.length; r++) {
    if (string(rows[r]?.[0]).toUpperCase() === "DETAIL") {
      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i] ?? [];
        if (/^total$/i.test(string(row[0]))) return typeof row[4] === "number" ? row[4] : null;
        if (string(row[0]).toUpperCase() === "DETAIL") break;
      }
    }
  }
  return null;
}

/** GRAINS block prices (col C) + VEGETABLES block prices (col I), keyed by
 * the raw item name as written in the sheet (case-sensitive, not run
 * through the importer's normalizeIngredient() -- this check is deliberately
 * independent of that mapping so it can't share a bug with it). */
function sheetPrices(rows) {
  const prices = new Map();
  for (const row of rows) {
    if (!row) continue;
    const leftName = string(row[0]);
    if (leftName && typeof row[2] === "number") prices.set(leftName, row[2]);
    const rightName = string(row[5]);
    if (rightName && typeof row[8] === "number") prices.set(rightName, row[8]);
  }
  return prices;
}

async function main() {
  loadEnvLocal();
  const fileArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const source = fileArg ?? DEFAULT_FILE;
  if (!existsSync(source)) throw new Error(`File not found: ${source}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const workbook = XLSX.read(readFileSync(source), { type: "buffer", cellDates: false, sheetStubs: true });

  const { data: ingredients, error: ingErr } = await supabase
    .from("kitchen_ingredients")
    .select("id, name");
  if (ingErr) throw new Error(`load ingredients: ${ingErr.message}`);
  const ingredientNameById = new Map(ingredients.map((i) => [i.id, i.name]));

  console.log("=== DETAIL total: headcount x days x price (ratio-independent) ===");
  console.log("month".padEnd(16), "| sheet total".padEnd(16), "| db total".padEnd(16), "| delta");
  for (const sheetName of MONTHS_2024) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(sheetName.padEnd(16), "| MISSING SHEET");
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const sheetTotal = sheetDetailTotal(rows);
    const monthNum = MONTHS_2024.indexOf(sheetName) + 1;
    const monthValue = monthStart(2024, monthNum);

    const { data: hcRows, error: hcErr } = await supabase
      .from("kitchen_headcount_lines")
      .select("headcount, days_in_period, price_per_person")
      .eq("school_id", USA_RIVER_ID)
      .eq("month", monthValue);
    if (hcErr) throw new Error(`load headcount for ${sheetName}: ${hcErr.message}`);
    const dbTotal = (hcRows ?? []).reduce((sum, h) => sum + h.headcount * h.days_in_period * h.price_per_person, 0);

    const delta = sheetTotal == null ? null : dbTotal - sheetTotal;
    console.log(
      sheetName.padEnd(16),
      "|",
      String(sheetTotal ?? "n/a").padEnd(14),
      "|",
      String(Math.round(dbTotal)).padEnd(14),
      "|",
      delta == null ? "n/a" : Math.round(delta).toLocaleString(),
    );
  }

  console.log();
  console.log("=== Ingredient prices: sheet's GRAINS/VEG block vs kitchen_ingredient_prices ===");
  for (const sheetName of MONTHS_2024) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const sheetPriceMap = sheetPrices(rows);
    const monthNum = MONTHS_2024.indexOf(sheetName) + 1;
    const monthValue = monthStart(2024, monthNum);

    const { data: priceRows, error: priceErr } = await supabase
      .from("kitchen_ingredient_prices")
      .select("ingredient_id, unit_price")
      .eq("school_id", USA_RIVER_ID)
      .eq("effective_date", monthValue);
    if (priceErr) throw new Error(`load prices for ${sheetName}: ${priceErr.message}`);

    let mismatches = 0;
    for (const row of priceRows ?? []) {
      const name = ingredientNameById.get(row.ingredient_id);
      // Sheet keys are raw item text (e.g. "Maize flour"); DB rows key by the
      // normalized catalog name (e.g. "Maize flour (ugali)") -- match loosely.
      const sheetPrice = [...sheetPriceMap.entries()].find(
        ([k]) => name && (k === name || name.startsWith(k) || k.startsWith(name.split(" (")[0])),
      )?.[1];
      if (sheetPrice != null && sheetPrice !== row.unit_price) {
        mismatches++;
        console.log(`  ${sheetName}: ${name} -- sheet=${sheetPrice} db=${row.unit_price}`);
      }
    }
    console.log(sheetName.padEnd(16), "|", priceRows?.length ?? 0, "prices checked,", mismatches, "mismatches");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
