#!/usr/bin/env node
/**
 * Imports 2026 Kitchen Master Sheet campus/month tabs into kitchen_* tables.
 *
 * Default: dry-run. Apply: node scripts/import-kitchens-master-2026.mjs --apply
 *
 * Mapping (from workbook audit):
 * - DETAIL → kitchen_headcount_lines (incl. June 2026 Holiday + hidden month tabs)
 * - Ratio + GRAINS/VEG unit prices & weekly veg rates → campus settings + prices
 * - Vendor blocks (Utele / Palate) → kitchen_purchases only
 * - Food Quality Tracker → kitchen_survey_responses
 * - Menu matrices / TOTAL REQUIRED / DETAIL totals / Budget Import → not imported
 *   (Budget Import is #REF!; Daily/Weekly/Monthly checklist score cells are blank;
 *   Learner survey tab header-only; no kitchen staff roster tab)
 *
 * Reads hidden Excel rows (collapsed "+"/outline groups). Do not push.
 * Requires schema_kitchen.sql applied + PostgREST reload.
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const DEFAULT_FILE = "/home/kiki/Downloads/2026 Kitchens Master Sheet.xlsx";
const IMPORT_TAG = "[Imported: Kitchens Master 2026]";

// Bare month-name tabs from before the 2026 campus-labeled tabs existed
// (e.g. "January 2024", "Jan 2025"). None carry a campus token -- see the
// Usa River attribution fallback in parseSheet().
const HISTORICAL_MONTH_TAB_RE =
  /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb)\s+(2024|2025)$/i;

// Sheet names where parseSheet() fell back to Usa River because no campus
// token was present -- printed in the run summary so the assumption is
// visible, not buried. Confirm with Kusaduka before treating as final.
const historicalUsaRiverFallback = [];

const SCHOOLS = [
  { id: "a1000000-0000-4000-8000-000000000001", aliases: ["usa river", "usariver", "usa"] },
  { id: "a1000000-0000-4000-8000-000000000002", aliases: ["arusha modern", "arusha", "am"] },
  { id: "a1000000-0000-4000-8000-000000000003", aliases: ["kijenge"] },
  { id: "a1000000-0000-4000-8000-000000000004", aliases: ["ilboru"] },
  { id: "a1000000-0000-4000-8000-000000000005", aliases: ["boma"] },
];

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const INGREDIENT_ALIASES = {
  rice: "Rice",
  beans: "Beans",
  "beans/kg": "Beans",
  "rice/kg": "Rice",
  "maize for makande": "Maize for makande",
  "makande / kg": "Maize for makande",
  "makande/kg": "Maize for makande",
  sugar: "Sugar",
  "sugar / kg": "Sugar",
  "maize flour": "Maize flour (ugali)",
  "flour - ugali /kg": "Maize flour (ugali)",
  "flour - ugali / kg": "Maize flour (ugali)",
  "cooking oil": "Cooking oil",
  "oil / liter": "Cooking oil",
  "tea leaf": "Tea leaf",
  salt: "Salt",
  choroko: "Choroko",
  "choroko/kg": "Choroko",
  tomatoes: "Tomatoes",
  onions: "Onions",
  "green pepper": "Green pepper",
  carrots: "Carrots",
  spices: "Spices",
  garlic: "Garlic",
  ginger: "Ginger",
  "watermelon/pinneapple": "Watermelon/pineapple",
  "watermelon/pineapple": "Watermelon/pineapple",
  bananas: "Bananas",
  oranges: "Oranges/Avocado",
  "oranges/avocado": "Oranges/Avocado",
  dagaa: "Dagaa",
  "green bean": "Green bean",
  "green beans": "Green bean",
};

const KNOWN_INGREDIENTS = new Set(Object.values(INGREDIENT_ALIASES));

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileArg = args.find((arg) => !arg.startsWith("--"));
const source = fileArg ?? DEFAULT_FILE;

function string(value) {
  return value == null ? "" : String(value).trim();
}

function number(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replaceAll(",", "").trim();
  if (!text || text.startsWith("#")) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const text = string(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function monthStart(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function toMonthStart(iso) {
  if (!iso || !iso.startsWith("2026-")) return null;
  return `${iso.slice(0, 7)}-01`;
}

function addMonths(ym01, n) {
  const year = Number(ym01.slice(0, 4));
  const month = Number(ym01.slice(5, 7));
  const dt = new Date(year, month - 1 + n, 1);
  return monthStart(dt.getFullYear(), dt.getMonth() + 1);
}

function normalizeIngredient(name) {
  const key = string(name).toLowerCase().replace(/\s+/g, " ");
  // Porridge flour has no separate seed row — skip.
  if (!key || key.includes("porridge")) return null;
  const mapped = INGREDIENT_ALIASES[key] ?? null;
  if (mapped) return mapped;
  // Allow exact seeded names only — never invent catalog rows from free text.
  const exact = string(name);
  return KNOWN_INGREDIENTS.has(exact) ? exact : null;
}

function categoryFor(name) {
  const n = name.toLowerCase();
  if (n.includes("meat")) return "meat";
  if (
    ["tomato", "onion", "pepper", "carrot", "spice", "garlic", "ginger", "watermelon", "banana", "orange", "avocado", "green bean"].some(
      (k) => n.includes(k),
    )
  ) {
    return "vegetable";
  }
  if (n.includes("dagaa")) return "other";
  return "grain";
}

function calcMethodFor(name) {
  const n = name.toLowerCase();
  if (
    ["salt", "tea", "tomato", "onion", "pepper", "carrot", "spice", "garlic", "ginger", "watermelon", "banana", "orange", "avocado", "dagaa", "meat", "green bean"].some(
      (k) => n.includes(k),
    )
  ) {
    return "flat_weekly";
  }
  return "headcount_ratio";
}

function resolveSchool(text) {
  const lower = string(text).toLowerCase();
  if (!lower) return null;
  // Exact short tokens first (holiday sheet uses "AM" / "Usariver").
  for (const school of SCHOOLS) {
    if (school.aliases.some((a) => lower === a)) return school;
  }
  // Prefer longer phrase matches for sheet titles.
  const ranked = [...SCHOOLS].sort(
    (a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length)),
  );
  for (const school of ranked) {
    if (school.aliases.some((a) => a.length >= 4 && lower.includes(a))) return school;
  }
  return null;
}

// Only "Jan 2025"/"Feb 2025" use abbreviations in the source workbook --
// every other tab (2024 and the rest of 2025) uses the full month name.
const MONTH_ABBREVIATIONS = { jan: 1, feb: 2 };

function parseMonthYearFromSheetName(sheetName) {
  const lower = sheetName.toLowerCase();
  const yearMatch = lower.match(/\b(202\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  for (const [name, num] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return { year, month: num };
  }
  for (const [abbr, num] of Object.entries(MONTH_ABBREVIATIONS)) {
    if (new RegExp(`\\b${abbr}\\b`).test(lower)) return { year, month: num };
  }
  return { year, month: null };
}

function monthFromVendorTitle(title) {
  const lower = string(title).toLowerCase();
  const year = Number(lower.match(/\b(202\d)\b/)?.[1] ?? 2026);
  for (const [name, num] of Object.entries(MONTHS)) {
    if (lower.includes(name)) return monthStart(year, num);
  }
  return null;
}

function shouldImportSheet(name) {
  const lower = name.toLowerCase().trim();
  const isHistoricalMonthTab = HISTORICAL_MONTH_TAB_RE.test(lower);
  if (/2024|2025/.test(lower) && !/2026/.test(lower) && !isHistoricalMonthTab) return false;
  if (lower === "june 2026 holiday") return true;
  if (
    /checklist|survey|summary|top sheet|calculation|office supplies|budget import|notes|sheet34|daycare|cleaning|team tasks|proposed|test test|food quality/.test(
      lower,
    )
  ) {
    return false;
  }
  if (isHistoricalMonthTab) return true;
  if (/-\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+2026/i.test(name)) {
    return true;
  }
  if (/-\s*2026\s*$/i.test(name) && resolveSchool(name)) return true;
  return false;
}

function rowsForSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function findRow(rows, predicate, from = 0, to = rows.length) {
  for (let r = from; r < to; r++) {
    if (predicate(rows[r] ?? [], r)) return r;
  }
  return -1;
}

function parseHeadcountLines(rows, start, end, schoolId, month) {
  const lines = [];
  let r = findRow(rows, (row) => string(row[0]).toUpperCase() === "DETAIL", start, end);
  if (r < 0) return lines;

  for (r = r + 1; r < end; r++) {
    const row = rows[r] ?? [];
    const label = string(row[0]);
    if (!label) continue;
    if (/^total$/i.test(label)) break;
    if (string(label).toUpperCase() === "DETAIL") break;
    const headcount = number(row[1]);
    const days = number(row[2]);
    const price = number(row[3]);
    if (headcount == null && days == null && price == null) continue;
    lines.push({
      school_id: schoolId,
      month,
      category: label,
      label,
      headcount: Math.round(headcount ?? 0),
      days_in_period: Math.round(days ?? 0),
      price_per_person: price ?? 0,
    });
  }
  return lines;
}

/** GRAINS/VEG → prices + campus settings only (not purchases — those are computed). */
function parseProcurementSettings(rows, start, end, schoolId, month) {
  const header = findRow(
    rows,
    (row) => /^items$/i.test(string(row[0])) && /kg/i.test(`${string(row[1])} ${string(row[2])}`),
    start,
    end,
  );
  const grains = findRow(rows, (row) => /^grains$/i.test(string(row[0])), start, end);
  const from = header >= 0 ? header : grains >= 0 ? grains + 1 : -1;
  if (from < 0) return { prices: [], settings: [], ingredients: [] };

  const prices = [];
  const settings = [];
  const ingredients = new Map();

  for (let r = from + (header >= 0 ? 1 : 0); r < end; r++) {
    const row = rows[r] ?? [];
    const leftName = string(row[0]);
    if (/^grand total$/i.test(string(row[3])) || /^grand total$/i.test(string(row[4]))) break;

    if (leftName && !/^grains$/i.test(leftName) && !/^items$/i.test(leftName) && !/^total$/i.test(leftName)) {
      const name = normalizeIngredient(leftName);
      if (name) {
        const unitPrice = number(row[2]);
        const qty = number(row[1]);
        ingredients.set(name, {
          name,
          unit: name.toLowerCase().includes("oil") ? "litre" : "kg",
          category: categoryFor(name),
          calc_method: calcMethodFor(name),
          default_unit_price: unitPrice ?? 0,
        });
        if (unitPrice != null) {
          prices.push({
            ingredient_name: name,
            school_id: schoolId,
            effective_date: month,
            unit_price: unitPrice,
          });
        }
        // Salt/tea often stored as monthly kg in GRAINS — keep as weeks_in_month=1.
        if (qty != null && ["Salt", "Tea leaf"].includes(name)) {
          settings.push({
            school_id: schoolId,
            ingredient_name: name,
            kg_per_week: qty,
            weeks_in_month: 1,
          });
        }
      }
    }

    const rightName = string(row[5]);
    if (rightName && !/^items$/i.test(rightName) && !/^vegetables$/i.test(rightName) && !/^total$/i.test(rightName)) {
      const name = normalizeIngredient(rightName);
      if (name) {
        const kgWeek = number(row[6]);
        const weeks = number(row[7]);
        const unitPrice = number(row[8]);
        ingredients.set(name, {
          name,
          unit: "kg",
          category: categoryFor(name),
          calc_method: "flat_weekly",
          kg_per_week: kgWeek,
          default_unit_price: unitPrice ?? 0,
        });
        if (unitPrice != null) {
          prices.push({
            ingredient_name: name,
            school_id: schoolId,
            effective_date: month,
            unit_price: unitPrice,
          });
        }
        if (kgWeek != null || weeks != null) {
          settings.push({
            school_id: schoolId,
            ingredient_name: name,
            kg_per_week: kgWeek,
            weeks_in_month: weeks,
          });
        }
      }
    }
  }

  return { prices, settings, ingredients: [...ingredients.values()] };
}

function parseRatioBlock(rows, start, end, schoolId) {
  const ratioHeader = findRow(
    rows,
    (row) => /no\.?\s*of\s*ppl\/kg/i.test(string(row[1])) || /no\.?\s*of\s*ppl\/kg/i.test(string(row[0])),
    start,
    end,
  );
  if (ratioHeader < 0) return [];

  const settings = [];
  for (let r = ratioHeader + 1; r < Math.min(ratioHeader + 20, end); r++) {
    const row = rows[r] ?? [];
    const raw = string(row[0]);
    if (!raw) continue;
    if (/^grains$/i.test(raw)) break;
    if (/^(usariver|items|arusha|kijenge|ilboru|boma)$/i.test(raw)) continue;
    if (/porridge/i.test(raw)) continue;
    const name = normalizeIngredient(raw);
    const people = number(row[1]);
    if (!name || people == null) continue;
    settings.push({
      school_id: schoolId,
      ingredient_name: name,
      people_per_kg: people,
    });
  }
  return settings;
}

function isVendorTitle(value) {
  const t = string(value);
  if (!t) return false;
  if (/^item\s*\/\s*description/i.test(t)) return false;
  return /(utele|palate|fresh\s*palate)/i.test(t) && /\b2026\b/.test(t);
}

function parseVendorPurchases(rows, defaultSchoolId) {
  const dual = [];
  const single = [];

  for (let r = 0; r < rows.length; r++) {
    const title = string(rows[r]?.[0]);
    if (!isVendorTitle(title)) continue;
    const month = monthFromVendorTitle(title);
    if (!month) continue;

    const header = rows[r + 1] ?? [];
    if (!/^item\s*\/\s*description/i.test(string(header[0]))) continue;

    const leftCampus = string(rows[r][1]).toLowerCase();
    const rightCampus = string(rows[r][4]).toLowerCase();
    const dualBlock = (leftCampus === "usa" || leftCampus.includes("usa")) && (rightCampus === "am" || rightCampus.includes("am"));

    for (let i = r + 2; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const item = string(row[0]);
      if (!item || /^total$/i.test(item) || isVendorTitle(item)) break;
      const name = normalizeIngredient(item);
      if (!name) continue;

      if (dualBlock) {
        const usaQty = number(row[1]);
        const usaPrice = number(row[2]);
        const usaTotal = number(row[3]);
        const amQty = number(row[4]);
        const amPrice = number(row[5]);
        const amTotal = number(row[6]);
        if (usaQty != null && usaQty > 0 && usaPrice != null) {
          dual.push({
            school_id: SCHOOLS[0].id,
            month,
            ingredient_name: name,
            quantity: usaQty,
            unit_price: usaPrice,
            total_cost: usaTotal ?? usaQty * usaPrice,
            purchased_on: month,
            notes: `${title} | Usa | ${IMPORT_TAG}`,
            vendorKey: `${title}|${month}`,
          });
        }
        if (amQty != null && amQty > 0 && amPrice != null) {
          dual.push({
            school_id: SCHOOLS[1].id,
            month,
            ingredient_name: name,
            quantity: amQty,
            unit_price: amPrice,
            total_cost: amTotal ?? amQty * amPrice,
            purchased_on: month,
            notes: `${title} | AM | ${IMPORT_TAG}`,
            vendorKey: `${title}|${month}`,
          });
        }
      } else if (defaultSchoolId) {
        const qty = number(row[1]);
        const unitPrice = number(row[2]);
        const total = number(row[3]);
        if (qty != null && qty > 0 && unitPrice != null) {
          single.push({
            school_id: defaultSchoolId,
            month,
            ingredient_name: name,
            quantity: qty,
            unit_price: unitPrice,
            total_cost: total ?? qty * unitPrice,
            purchased_on: month,
            notes: `${title} | ${IMPORT_TAG}`,
            vendorKey: `${title}|${month}`,
          });
        }
      }
    }
  }

  // Prefer dual-campus attribution over rolled-up combined vendor totals.
  const dualKeys = new Set(dual.map((p) => p.vendorKey.replace(/\s+/g, " ").toLowerCase()));
  const filteredSingle = single.filter((p) => {
    const key = p.vendorKey.replace(/\s+/g, " ").toLowerCase();
    // Same vendor title on dual sheet → skip combined duplicate.
    if ([...dualKeys].some((d) => d.split("|")[0] === key.split("|")[0] && d.endsWith(`|${p.month}`))) {
      return false;
    }
    // Also drop rolled-up Utele/Palate when a dual Utele/Palate exists for month.
    const stem = key.replace(/fresh\s*/i, "").split("|")[0];
    for (const d of dualKeys) {
      const dStem = d.replace(/fresh\s*/i, "").split("|")[0];
      if (d.endsWith(`|${p.month}`) && (stem.includes("utele") ? dStem.includes("utele") : stem.includes("palate") && dStem.includes("palate"))) {
        return false;
      }
    }
    return true;
  });

  return [...dual, ...filteredSingle].map(({ vendorKey: _vk, ...rest }) => rest);
}

function splitMonthBlocks(rows, sheetMeta) {
  if (sheetMeta.month) {
    return [
      {
        start: 0,
        end: rows.length,
        month: monthStart(sheetMeta.year ?? 2026, sheetMeta.month),
      },
    ];
  }

  const detailRows = [];
  for (let r = 0; r < rows.length; r++) {
    if (string(rows[r]?.[0]).toUpperCase() === "DETAIL") detailRows.push(r);
  }
  if (!detailRows.length) return [];

  const blocks = [];
  let prevMonth = null;
  for (let i = 0; i < detailRows.length; i++) {
    const detailAt = detailRows[i];
    let month = null;
    for (let r = detailAt; r >= Math.max(0, detailAt - 40); r--) {
      const d = toMonthStart(isoDate(rows[r]?.[0]));
      if (d) {
        month = d;
        break;
      }
    }
    if (!month) {
      month = prevMonth ? addMonths(prevMonth, 1) : "2026-03-01";
    }
    // Avoid two DETAIL blocks collapsing onto the same month when undated.
    if (prevMonth && month <= prevMonth) month = addMonths(prevMonth, 1);

    const start = i === 0 ? 0 : Math.min(detailRows[i - 1] + 1, detailAt);
    // Block starts at prior date marker if present, else after previous detail.
    let blockStart = i === 0 ? 0 : detailRows[i - 1] + 1;
    for (let r = detailAt; r >= (i === 0 ? 0 : detailRows[i - 1] + 1); r--) {
      if (toMonthStart(isoDate(rows[r]?.[0]))) {
        blockStart = r;
        break;
      }
    }
    const blockEnd = i + 1 < detailRows.length ? detailRows[i + 1] : rows.length;
    blocks.push({ start: blockStart, end: blockEnd, month, detailAt });
    prevMonth = month;
    void start;
  }
  return blocks;
}

function parseHolidaySheet(rows) {
  const result = {
    sheetName: "June 2026 Holiday",
    schoolId: null,
    headcounts: [],
    purchases: [],
    prices: [],
    settings: [],
    ingredients: [],
  };
  const month = "2026-06-01";
  let school = null;
  for (let r = 0; r < rows.length; r++) {
    const label = string(rows[r]?.[0]);
    const maybe = resolveSchool(label);
    if (maybe && !/^detail$/i.test(label)) school = maybe;
    if (string(label).toUpperCase() !== "DETAIL" || !school) continue;
    const end = findRow(
      rows,
      (row, idx) =>
        idx > r &&
        (string(row[0]).toUpperCase() === "DETAIL" ||
          Boolean(resolveSchool(string(row[0])) && !/^detail$/i.test(string(row[0])))),
      r + 1,
      rows.length,
    );
    const blockEnd = end >= 0 ? end : rows.length;
    result.headcounts.push(...parseHeadcountLines(rows, r, blockEnd, school.id, month));
  }
  return result.headcounts.length ? result : null;
}

function parseSheet(workbook, sheetName) {
  if (sheetName.toLowerCase() === "june 2026 holiday") {
    return parseHolidaySheet(rowsForSheet(workbook, sheetName));
  }

  const meta = parseMonthYearFromSheetName(sheetName);
  if (meta.year && ![2024, 2025, 2026].includes(meta.year)) return null;

  let school = resolveSchool(sheetName);
  if (!school && meta.year && meta.year !== 2026 && meta.month) {
    // ASSUMPTION (flag for Kusaduka, not fabricated): historical 2024/2025
    // tabs carry no campus label because they predate the multi-campus
    // rollout. Attributed to Usa River -- cheap to correct later (just a
    // school_id), not fabricated figures.
    school = SCHOOLS[0];
    historicalUsaRiverFallback.push(sheetName);
  }
  if (!school) return null;

  const rows = rowsForSheet(workbook, sheetName);
  const blocks = splitMonthBlocks(rows, meta);
  if (!blocks.length) return null;

  const result = {
    sheetName,
    schoolId: school.id,
    headcounts: [],
    purchases: [],
    prices: [],
    settings: [],
    ingredients: [],
  };

  for (const block of blocks) {
    result.headcounts.push(
      ...parseHeadcountLines(rows, block.start, block.end, school.id, block.month),
    );
    const proc = parseProcurementSettings(rows, block.start, block.end, school.id, block.month);
    result.prices.push(...proc.prices);
    result.settings.push(...proc.settings);
    result.ingredients.push(...proc.ingredients);
    result.settings.push(...parseRatioBlock(rows, block.start, block.end, school.id));
  }

  result.purchases.push(...parseVendorPurchases(rows, school.id));
  return result;
}

function mergeIngredientDefaults(list) {
  const map = new Map();
  for (const item of list) {
    if (!item?.name) continue;
    const prev = map.get(item.name) ?? {};
    map.set(item.name, {
      name: item.name,
      unit: item.unit ?? prev.unit ?? "kg",
      category: item.category ?? prev.category ?? "grain",
      calc_method: item.calc_method ?? prev.calc_method ?? "headcount_ratio",
      people_per_kg: item.people_per_kg ?? prev.people_per_kg ?? null,
      kg_per_week: item.kg_per_week ?? prev.kg_per_week ?? null,
      default_unit_price: item.default_unit_price || prev.default_unit_price || 0,
      active: true,
    });
  }
  return [...map.values()];
}

function buildRecords(workbook) {
  const sheetNames = workbook.SheetNames.filter(shouldImportSheet);
  const parsed = sheetNames.map((name) => parseSheet(workbook, name)).filter(Boolean);

  const monthTabKeys = new Set();
  for (const p of parsed) {
    if (/-\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+2026/i.test(p.sheetName)) {
      for (const h of p.headcounts) monthTabKeys.add(`${h.school_id}|${h.month}`);
    }
  }

  const headcounts = [];
  const purchases = [];
  const prices = [];
  const settings = [];
  const ingredients = [];
  const usedSheets = [];
  const purchaseKeys = new Set();

  for (const p of parsed) {
    const isAnnual = /-\s*2026\s*$/i.test(p.sheetName);
    const keepHeadcounts = p.headcounts.filter(
      (h) => !isAnnual || !monthTabKeys.has(`${h.school_id}|${h.month}`),
    );
    const keepPrices = p.prices.filter(
      (x) => !isAnnual || !monthTabKeys.has(`${x.school_id}|${x.effective_date}`),
    );
    if (!keepHeadcounts.length && !p.purchases.length && !keepPrices.length && isAnnual) {
      // still keep annual if it has purchases for later months
      if (!p.purchases.length) continue;
    }

    usedSheets.push(p.sheetName);
    headcounts.push(...keepHeadcounts);
    prices.push(...keepPrices);
    settings.push(...p.settings);
    ingredients.push(...p.ingredients);

    for (const purchase of p.purchases) {
      const key = [
        purchase.school_id,
        purchase.month,
        purchase.ingredient_name,
        purchase.quantity,
        purchase.unit_price,
        purchase.notes,
      ].join("|");
      if (purchaseKeys.has(key)) continue;
      purchaseKeys.add(key);
      purchases.push(purchase);
    }
  }

  // Across sheets: dual Usa/AM vendor lines win over rolled-up single-column totals.
  const dualVendorMonths = new Set(
    purchases
      .filter((p) => /\|\s*(Usa|AM)\s*\|/i.test(p.notes ?? ""))
      .map((p) => {
        const vendor = string(p.notes).split("|")[0].toLowerCase().replace(/\s+/g, " ");
        return `${vendor}|${p.month}|${p.school_id}`;
      }),
  );
  const dedupedPurchases = purchases.filter((p) => {
    if (/\|\s*(Usa|AM)\s*\|/i.test(p.notes ?? "")) return true;
    const vendor = string(p.notes).split("|")[0].toLowerCase().replace(/\s+/g, " ");
    // Drop AM/Usa rolled-up rows when dual attribution exists for that vendor+month+school.
    if (dualVendorMonths.has(`${vendor}|${p.month}|${p.school_id}`)) return false;
    // Drop combined totals aimed at one campus when dual exists for either campus same vendor+month.
    const dualExists = [...dualVendorMonths].some((k) => k.startsWith(`${vendor}|${p.month}|`));
    if (dualExists) return false;
    // Fresh Palate vs Palate naming
    const stem = vendor.replace(/^fresh\s+/, "");
    const stemDual = [...dualVendorMonths].some((k) => {
      const v = k.split("|")[0].replace(/^fresh\s+/, "");
      return k.includes(`|${p.month}|`) && ((stem.includes("utele") && v.includes("utele")) || (stem.includes("palate") && v.includes("palate")));
    });
    return !stemDual;
  });

  return {
    sheets: usedSheets,
    headcounts,
    purchases: dedupedPurchases,
    prices,
    settings,
    ingredients: mergeIngredientDefaults(ingredients),
    surveys: parseFoodQualityTracker(workbook),
  };
}

function parseFoodQualityTracker(workbook) {
  const sheet =
    workbook.Sheets["Food Quality Tracker"] ??
    workbook.Sheets[workbook.SheetNames.find((n) => /food quality/i.test(n)) ?? ""];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const out = [];
  for (const row of rows) {
    const qualityRaw =
      row["How would you rate today’s food quality?"] ??
      row["How would you rate today's food quality?"];
    const consistencyRaw =
      row["How consistent was today’s meal compared to previous days?"] ??
      row["How consistent was today's meal compared to previous days?"];
    const satisfactionRaw =
      row["Did the students seem satisfied with today’s meal?"] ??
      row["Did the students seem satisfied with today's meal?"];
    const comment =
      row["Write any comments or suggestions to improve today’s meal?"] ??
      row["Write any comments or suggestions to improve today's meal?"] ??
      null;
    const classOrGrade = row["What is your class?"] ?? null;

    const quality = string(qualityRaw).toLowerCase();
    const quality_rating = ["poor", "fair", "good", "excellent"].includes(quality)
      ? quality
      : null;
    const onTime = string(row["Was the food served on time today?"]).toLowerCase();
    const qty = string(
      row["Was the food served in sufficient quantity for all students?"],
    ).toLowerCase();
    const consistency = string(consistencyRaw).toLowerCase();
    const satisfaction = string(satisfactionRaw).toLowerCase();

    let consistency_rating = null;
    if (consistency.includes("very")) consistency_rating = "very_consistent";
    else if (consistency.includes("somewhat")) consistency_rating = "somewhat_consistent";
    else if (consistency.includes("not")) consistency_rating = "not_consistent";

    let satisfaction_level = null;
    if (satisfaction.includes("most")) satisfaction_level = "most_satisfied";
    else if (satisfaction.includes("many")) satisfaction_level = "many_not_satisfied";
    else if (satisfaction.includes("some")) satisfaction_level = "some_not_satisfied";

    const ts = row.Timestamp ?? row.timestamp;
    let submitted_at = new Date().toISOString();
    if (ts instanceof Date && !Number.isNaN(ts.getTime())) submitted_at = ts.toISOString();
    else if (typeof ts === "number" && Number.isFinite(ts)) {
      // Excel serial date
      const parsed = XLSX.SSF.parse_date_code(ts);
      if (parsed) {
        submitted_at = new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S),
        ).toISOString();
      }
    } else if (ts) {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) submitted_at = d.toISOString();
    }

    if (!quality_rating && !classOrGrade && !comment) continue;
    out.push({
      submitted_at,
      school_id: null,
      class_or_grade: classOrGrade ? string(classOrGrade) : null,
      source: "food_quality_tracker",
      quality_rating,
      served_on_time: onTime === "yes" ? true : onTime === "no" ? false : null,
      sufficient_quantity: qty === "yes" ? true : qty === "no" ? false : null,
      consistency_rating,
      satisfaction_level,
      comment_text: comment ? string(comment) : null,
    });
  }
  return out;
}

function chunk(items, size = 200) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function applyRecords(supabase, records) {
  for (const batch of chunk(records.ingredients, 50)) {
    const { error } = await supabase.from("kitchen_ingredients").upsert(batch, {
      onConflict: "name",
    });
    if (error) throw new Error(`kitchen_ingredients: ${error.message}`);
  }

  const { data: ingredientRows, error: ingErr } = await supabase
    .from("kitchen_ingredients")
    .select("id, name");
  if (ingErr) throw new Error(`load ingredients: ${ingErr.message}`);
  const idByName = new Map((ingredientRows ?? []).map((r) => [r.name, r.id]));

  const monthsBySchool = new Map();
  for (const row of records.headcounts) {
    if (!monthsBySchool.has(row.school_id)) monthsBySchool.set(row.school_id, new Set());
    monthsBySchool.get(row.school_id).add(row.month);
  }
  for (const purchase of records.purchases) {
    if (!monthsBySchool.has(purchase.school_id)) monthsBySchool.set(purchase.school_id, new Set());
    monthsBySchool.get(purchase.school_id).add(purchase.month);
  }

  for (const [schoolId, months] of monthsBySchool) {
    for (const month of months) {
      const { error } = await supabase
        .from("kitchen_headcount_lines")
        .delete()
        .eq("school_id", schoolId)
        .eq("month", month);
      if (error) throw new Error(`clear headcounts: ${error.message}`);
    }
  }
  for (const batch of chunk(records.headcounts)) {
    const { error } = await supabase.from("kitchen_headcount_lines").insert(batch);
    if (error) throw new Error(`kitchen_headcount_lines: ${error.message}`);
  }

  for (const [schoolId, months] of monthsBySchool) {
    for (const month of months) {
      const { data: old, error } = await supabase
        .from("kitchen_purchases")
        .select("id, notes")
        .eq("school_id", schoolId)
        .eq("month", month);
      if (error) throw new Error(`load purchases: ${error.message}`);
      const ids = (old ?? [])
        .filter((r) => string(r.notes).includes(IMPORT_TAG))
        .map((r) => r.id);
      if (ids.length) {
        const { error: delErr } = await supabase.from("kitchen_purchases").delete().in("id", ids);
        if (delErr) throw new Error(`clear purchases: ${delErr.message}`);
      }
    }
  }

  const purchaseRows = records.purchases
    .map((p) => {
      const ingredient_id = idByName.get(p.ingredient_name);
      if (!ingredient_id) return null;
      return {
        school_id: p.school_id,
        month: p.month,
        ingredient_id,
        quantity: p.quantity,
        unit_price: p.unit_price,
        total_cost: p.total_cost,
        purchased_on: p.purchased_on,
        notes: p.notes,
      };
    })
    .filter(Boolean);
  for (const batch of chunk(purchaseRows)) {
    const { error } = await supabase.from("kitchen_purchases").insert(batch);
    if (error) throw new Error(`kitchen_purchases: ${error.message}`);
  }

  const priceMap = new Map();
  for (const p of records.prices) {
    const ingredient_id = idByName.get(p.ingredient_name);
    if (!ingredient_id) continue;
    // Last price wins when the same campus/month appears on month + annual tabs.
    priceMap.set(`${ingredient_id}|${p.school_id}|${p.effective_date}`, {
      ingredient_id,
      school_id: p.school_id,
      effective_date: p.effective_date,
      unit_price: p.unit_price,
    });
  }
  const priceRows = [...priceMap.values()];
  for (const batch of chunk(priceRows, 50)) {
    const { error } = await supabase.from("kitchen_ingredient_prices").upsert(batch, {
      onConflict: "ingredient_id,school_id,effective_date",
    });
    if (error) throw new Error(`kitchen_ingredient_prices: ${error.message}`);
  }

  const settingMap = new Map();
  for (const s of records.settings) {
    const ingredient_id = idByName.get(s.ingredient_name);
    if (!ingredient_id) continue;
    const key = `${s.school_id}|${ingredient_id}`;
    const prev = settingMap.get(key) ?? {
      school_id: s.school_id,
      ingredient_id,
      people_per_kg: null,
      kg_per_week: null,
      weeks_in_month: null,
    };
    settingMap.set(key, {
      ...prev,
      people_per_kg: s.people_per_kg ?? prev.people_per_kg,
      kg_per_week: s.kg_per_week ?? prev.kg_per_week,
      weeks_in_month: s.weeks_in_month ?? prev.weeks_in_month,
    });
  }
  const settingRows = [...settingMap.values()];
  for (const batch of chunk(settingRows, 50)) {
    const { error } = await supabase
      .from("kitchen_ingredient_campus_settings")
      .upsert(batch, { onConflict: "school_id,ingredient_id" });
    if (error) throw new Error(`kitchen_ingredient_campus_settings: ${error.message}`);
  }

  // Food Quality Tracker has real Oct 2025 responses; Learner survey tab is header-only.
  const { error: clearSurveys } = await supabase
    .from("kitchen_survey_responses")
    .delete()
    .eq("source", "food_quality_tracker");
  if (clearSurveys) throw new Error(`clear surveys: ${clearSurveys.message}`);
  for (const batch of chunk(records.surveys ?? [], 50)) {
    const { error } = await supabase.from("kitchen_survey_responses").insert(batch);
    if (error) throw new Error(`kitchen_survey_responses: ${error.message}`);
  }

  return {
    ingredients: records.ingredients.length,
    headcounts: records.headcounts.length,
    purchases: purchaseRows.length,
    prices: priceRows.length,
    settings: settingRows.length,
    sheets: records.sheets.length,
    surveys: (records.surveys ?? []).length,
    budgets: 0,
  };
}

async function main() {
  loadEnvLocal();
  if (!existsSync(source)) throw new Error(`File not found: ${source}`);

  const workbook = XLSX.read(readFileSync(source), {
    type: "buffer",
    cellDates: false,
    sheetStubs: true,
  });
  const records = buildRecords(workbook);

  console.log("Parsed Kitchens Master:", {
    file: source,
    sheets: records.sheets,
    ingredients: records.ingredients.length,
    headcounts: records.headcounts.length,
    purchases: records.purchases.length,
    prices: records.prices.length,
    settings: records.settings.length,
    surveys: records.surveys.length,
    budgets: 0,
  });
  console.log("Sample headcount:", records.headcounts[0]);
  console.log("Sample purchase:", records.purchases[0] ?? null);
  console.log(
    "Holiday lines:",
    records.headcounts.filter((h) => h.month === "2026-06-01").length,
  );
  console.log(
    "Historical tabs attributed to Usa River (verify with Kusaduka):",
    historicalUsaRiverFallback.length,
  );
  historicalUsaRiverFallback.forEach((s) => console.log("  -", s));

  if (!apply) {
    console.log("Dry run — pass --apply to write.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: probe } = await supabase.from("kitchen_ingredients").select("id").limit(1);
  if (probe) {
    throw new Error(
      `Kitchen schema not available (${probe.message}). Run supabase/APPLY_KITCHEN_01_ROLES.sql then supabase/APPLY_KITCHEN_02_TABLES.sql`,
    );
  }

  const summary = await applyRecords(supabase, records);
  console.log("Imported:", summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
