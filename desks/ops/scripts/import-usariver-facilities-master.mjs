#!/usr/bin/env node
/**
 * Imports the Usa River Facilities Master workbook into facilities_* tables.
 *
 * Default: dry-run. Apply: node scripts/import-usariver-facilities-master.mjs --apply
 *
 * Reads grouped/hidden checklist descriptors from "Copy of 1. Checklist "
 * (the Excel "+" expand content) and scores from "1. Checklist ".
 * Generator months are stacked blocks (January labeled "Top").
 *
 * Do not push from this script.
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const DEFAULT_FILE =
  "/home/kiki/Downloads/2026  Facilities Master Sheet (Usariver).xlsx";
const USARIVER_SCHOOL_ID = "a1000000-0000-4000-8000-000000000001";
const IMPORT_TAG = "[Imported: Usa River Facilities Master 2026]";
const YEAR = 2026;

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

function rowsFor(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Workbook has no "${sheetName}" sheet`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function string(value) {
  return value == null ? "" : String(value).trim();
}

function number(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replaceAll(",", "").trim();
  if (!text) return null;
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

function statusFromSheet(raw) {
  const s = string(raw).toLowerCase();
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "in progress" || s === "in_progress") return "in_progress";
  return "open";
}

function monthNumber(name) {
  return MONTHS[string(name).toLowerCase()] ?? null;
}

function ymd(year, month, day) {
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse "13th - 16th" / "29th-3rd" under a month label into walkthrough_date. */
function weekWalkthroughDate(monthName, label) {
  let month = monthNumber(monthName);
  if (!month) return null;
  const nums = String(label)
    .match(/\d+/g)
    ?.map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (!nums?.length) return null;
  let start = nums[0];
  const end = nums[1] ?? start;
  // Cross-month ranges mislabeled under the end month (e.g. OCTOBER "29th-3rd").
  if (end < start && start >= 20) {
    month = month === 1 ? 12 : month - 1;
  }
  return ymd(YEAR, month, start);
}

function chunk(items, size = 200) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function parseIssues(rows) {
  const out = [];
  for (const row of rows.slice(2)) {
    const description = string(row[1]);
    if (!description) continue;
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      description,
      status: statusFromSheet(row[2]),
      reported_by: string(row[3]) || null,
      report_date: isoDate(row[4]) ?? `${YEAR}-01-01`,
      deadline: isoDate(row[5]),
      accountable: string(row[6]) || null,
      responsible: string(row[7]) || null,
      next_steps: string(row[8]) || null,
      resolved_date: isoDate(row[9]),
      notes: [string(row[10]), IMPORT_TAG].filter(Boolean).join("\n"),
    });
  }
  return out;
}

function parseChecklistDescriptors(copyRows) {
  // First block only — the sheet repeats the same checklist further down.
  // Descriptors live on "Copy of 1. Checklist " (Excel "+" expand content).
  const descriptors = [];
  let area = null;
  let sawDescriptor = false;
  for (let r = 10; r < copyRows.length; r++) {
    const row = copyRows[r] ?? [];
    const a = string(row[0]);
    const b = string(row[1]);
    if (/^monthly average$/i.test(b) || /^checks done$/i.test(b)) break;
    if (/^area$/i.test(a) && sawDescriptor) break;
    if (a && !/^(area|usariver)$/i.test(a) && a !== "") {
      area = a.replace(/:$/, "");
    }
    if (!b || /^(descriptors|only cleanliness|discription|total|actual facilites checklist score|target facilites checklist score)$/i.test(b)) {
      continue;
    }
    if (!area) continue;
    descriptors.push({ area, descriptor: b, rowIndex: r });
    sawDescriptor = true;
  }
  return descriptors;
}

function parseChecklistScores(scoreRows, descriptors) {
  // Row 9 = month labels, row 10 = week labels (0-index: 8 and 9).
  const monthRow = scoreRows[8] ?? [];
  const labelRow = scoreRows[9] ?? [];
  let month = null;
  const weekCols = [];
  for (let c = 2; c < Math.max(monthRow.length, labelRow.length); c++) {
    const m = string(monthRow[c]);
    if (m) month = m.toUpperCase();
    const label = string(labelRow[c]);
    if (!label || /comment/i.test(label) || !month) continue;
    const walkthrough_date = weekWalkthroughDate(month, label);
    if (!walkthrough_date) continue;
    weekCols.push({ c, walkthrough_date, label, month });
  }

  const out = [];
  for (const desc of descriptors) {
    const row = scoreRows[desc.rowIndex] ?? [];
    for (const week of weekCols) {
      const score = number(row[week.c]);
      if (score == null || score < 1 || score > 5) continue;
      const comments = string(row[week.c + 1]) || null;
      out.push({
        school_id: USARIVER_SCHOOL_ID,
        area: `${desc.area}: ${desc.descriptor}`,
        walkthrough_date: week.walkthrough_date,
        score: Math.round(score),
        comments,
        inspector: null,
      });
    }
  }
  return out;
}

function parseGenerator(rows) {
  const monthNames = new Set([
    "top",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ]);
  const blocks = [];
  for (let r = 0; r < rows.length; r++) {
    const label = string(rows[r]?.[0]).toLowerCase();
    if (!monthNames.has(label)) continue;
    const month = label === "top" ? 1 : monthNumber(label);
    if (!month) continue;
    blocks.push({ start: r, month });
  }

  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const { start, month } = blocks[i];
    const end = i + 1 < blocks.length ? blocks[i + 1].start : rows.length;
    let headerRow = -1;
    for (let r = start; r < Math.min(start + 4, end); r++) {
      for (let c = 2; c < (rows[r]?.length ?? 0); c += 2) {
        const day = number(rows[r][c]);
        if (day != null && day >= 1 && day <= 31) {
          headerRow = r;
          break;
        }
      }
      if (headerRow >= 0) break;
    }
    if (headerRow < 0) continue;

    const dayCols = [];
    const header = rows[headerRow] ?? [];
    for (let c = 2; c < header.length; c += 2) {
      const day = number(header[c]);
      if (day == null || day < 1 || day > 31) continue;
      const date = ymd(YEAR, month, Math.trunc(day));
      if (!date) continue;
      dayCols.push({ c, date });
    }

    for (let r = headerRow + 1; r < end; r++) {
      const task = string(rows[r]?.[0]);
      if (!task) continue;
      if (/^(checks done|average rating|task)$/i.test(task)) continue;
      if (monthNames.has(task.toLowerCase())) break;
      for (const day of dayCols) {
        const score = number(rows[r][day.c]);
        if (score == null || score < 1 || score > 5) continue;
        out.push({
          school_id: USARIVER_SCHOOL_ID,
          task,
          log_date: day.date,
          score: Math.round(score),
          comments: string(rows[r][day.c + 1]) || null,
          inspector: null,
        });
      }
    }
  }
  return out;
}

function parseHouses(rows) {
  // v2 schema: house definitions + separate occupancy log (no status/occupant columns).
  const houses = [];
  const occupancy = [];
  for (const row of rows.slice(8)) {
    const letter = string(row[1]);
    const name = string(row[2]);
    if (!letter || !name) continue;
    const rooms = string(row[3]);
    const furniture = string(row[4]).toLowerCase();
    let occupant = null;
    for (let c = 5; c < row.length; c++) {
      const cell = string(row[c]);
      if (cell) {
        occupant = cell.replace(/\s+/g, " ");
        break;
      }
    }
    houses.push({
      school_id: USARIVER_SCHOOL_ID,
      house_letter: letter,
      house_name: name,
      rooms_description: rooms || null,
      furniture_status: furniture === "furnished" ? "furnished" : "unfurnished",
      notes: IMPORT_TAG,
    });
    if (occupant) {
      // Sheet weeks lack a year — treat as 2026 staff housing stretch (Jun–Dec).
      const dateMatch = occupant.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
      occupancy.push({
        house_letter: letter,
        occupant,
        period_start: dateMatch
          ? `2026-06-${String(dateMatch[1]).padStart(2, "0")}`
          : "2026-06-01",
        period_end: dateMatch
          ? `2026-06-${String(dateMatch[2]).padStart(2, "0")}`
          : "2026-12-31",
        notes: IMPORT_TAG,
      });
    }
  }
  return { houses, occupancy };
}

function parsePower(rows) {
  const out = [];
  for (const row of rows.slice(1)) {
    const reading_date = isoDate(row[0]);
    if (!reading_date) continue;
    const units_received = number(row[1]);
    const units_spent = number(row[2]);
    const balance_units = number(row[3]);
    // Sheet pads a full-year date column; only real meter fills have units.
    if (units_received == null && units_spent == null) continue;
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      reading_date,
      units_received,
      units_spent,
      balance_units,
    });
  }
  return out;
}

function parseCctv(rows) {
  const out = [];
  let cameraType = null;
  for (const row of rows.slice(2)) {
    const type = string(row[0]);
    if (type) {
      // Section labels (Lower/Upper Primary) are not camera types.
      if (/primary|summary|total/i.test(type)) {
        cameraType = null;
        continue;
      }
      cameraType = type;
    }
    const location = string(row[1]);
    const quantity = number(row[2]);
    if (!location || quantity == null) continue;
    if (/primary|summary|total/i.test(location)) continue;
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      camera_type: cameraType,
      location,
      quantity: Math.trunc(quantity),
      description: string(row[3]) || IMPORT_TAG,
    });
  }
  return out;
}

function parseClassroomItems(rows) {
  const out = [];
  let grade = null;
  for (const row of rows.slice(1)) {
    const maybeGrade = string(row[1]);
    if (maybeGrade) grade = maybeGrade;
    const item_name = string(row[2]);
    if (!item_name) continue;
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      grade,
      item_name,
      quantity: number(row[3]) != null ? Math.trunc(number(row[3])) : null,
      remarks: [string(row[4]), IMPORT_TAG].filter(Boolean).join("\n") || IMPORT_TAG,
    });
  }
  return out;
}

function parseSops(rows) {
  if (!rows.length) return [];
  const roleRow = rows[0] ?? [];
  const freqRow = rows[1] ?? [];
  const roles = [];
  let currentRole = null;
  for (let c = 0; c < Math.max(roleRow.length, freqRow.length); c++) {
    const role = string(roleRow[c]);
    if (role) currentRole = role;
    const freq = string(freqRow[c]);
    if (currentRole && freq) roles.push({ c, role: currentRole, freq });
  }

  const out = [];
  for (const col of roles) {
    const tasks = [];
    for (let r = 2; r < rows.length; r++) {
      const cell = string(rows[r]?.[col.c]);
      if (cell) tasks.push(cell);
    }
    if (!tasks.length) continue;
    out.push({
      school_id: USARIVER_SCHOOL_ID,
      title: `${col.role} — ${col.freq}`,
      category: col.role,
      content: `${tasks.map((t) => `• ${t}`).join("\n")}\n\n${IMPORT_TAG}`,
    });
  }

  // Hidden score descriptors (Excel "+" rows 3–8 on checklist).
  out.push({
    school_id: USARIVER_SCHOOL_ID,
    title: "Weekly checklist score scale (1–5)",
    category: "Checklist",
    content: [
      "1 — Poor",
      "2 — Fair",
      "3 — Average",
      "4 — Good",
      "5 — Excellent",
      "",
      IMPORT_TAG,
    ].join("\n"),
  });
  return out;
}

function buildRecords(workbook) {
  const descriptors = parseChecklistDescriptors(rowsFor(workbook, "Copy of 1. Checklist "));
  const housing = parseHouses(rowsFor(workbook, "Houses Accomodation"));
  return {
    issues: parseIssues(rowsFor(workbook, "3. Facilities R&M ")),
    checklist: parseChecklistScores(rowsFor(workbook, "1. Checklist "), descriptors),
    generator: parseGenerator(rowsFor(workbook, "2. Generator Checklist")),
    houses: housing.houses,
    occupancy: housing.occupancy,
    power: parsePower(rowsFor(workbook, "Power Usage")),
    cctv: parseCctv(rowsFor(workbook, "CCTV")),
    classroom: parseClassroomItems(rowsFor(workbook, "Classrooms facility Report")),
    sops: parseSops(rowsFor(workbook, "Facilities SOPs")),
    descriptorCount: descriptors.length,
  };
}

async function insertBatched(supabase, table, rows) {
  let inserted = 0;
  for (const batch of chunk(rows)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += batch.length;
  }
  return inserted;
}

async function applyRecords(supabase, records) {
  const summary = {};

  // Issues — dedupe by description|report_date
  {
    const { data: existing, error } = await supabase
      .from("facilities_issues")
      .select("description, report_date")
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (error) throw new Error(`load issues: ${error.message}`);
    const seen = new Set((existing ?? []).map((r) => `${r.description}|${r.report_date}`));
    const fresh = records.issues.filter((r) => !seen.has(`${r.description}|${r.report_date}`));
    summary.issues = await insertBatched(supabase, "facilities_issues", fresh);
  }

  // Checklist — replace prior import for this school (full sheet reload)
  {
    const { error: delErr } = await supabase
      .from("facilities_checklist_scores")
      .delete()
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (delErr) throw new Error(`clear checklist: ${delErr.message}`);
    summary.checklist = await insertBatched(
      supabase,
      "facilities_checklist_scores",
      records.checklist,
    );
  }

  // Generator — replace prior import for this school
  {
    const { error: delErr } = await supabase
      .from("facilities_generator_log")
      .delete()
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (delErr) throw new Error(`clear generator: ${delErr.message}`);
    summary.generator = await insertBatched(
      supabase,
      "facilities_generator_log",
      records.generator,
    );
  }

  // Houses (v2) — upsert by house_letter for school, then occupancy log
  {
    const { data: existing, error } = await supabase
      .from("facilities_houses")
      .select("id, house_letter")
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (error) throw new Error(`load houses: ${error.message}`);
    const byLetter = new Map((existing ?? []).map((r) => [string(r.house_letter).toUpperCase(), r.id]));
    let upserted = 0;
    for (const house of records.houses) {
      const key = string(house.house_letter).toUpperCase();
      const id = byLetter.get(key);
      if (id) {
        const { error: upErr } = await supabase
          .from("facilities_houses")
          .update({
            house_name: house.house_name,
            rooms_description: house.rooms_description,
            furniture_status: house.furniture_status,
            notes: house.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (upErr) throw new Error(`houses update: ${upErr.message}`);
        byLetter.set(key, id);
      } else {
        const { data: inserted, error: inErr } = await supabase
          .from("facilities_houses")
          .insert(house)
          .select("id, house_letter")
          .single();
        if (inErr) throw new Error(`houses insert: ${inErr.message}`);
        byLetter.set(key, inserted.id);
      }
      upserted += 1;
    }
    summary.houses = upserted;

    const { data: oldOcc, error: oldOccErr } = await supabase
      .from("facilities_house_occupancy")
      .select("id, notes, house_id");
    if (oldOccErr) throw new Error(`load occupancy: ${oldOccErr.message}`);
    const oldIds = (oldOcc ?? [])
      .filter((r) => string(r.notes).includes(IMPORT_TAG))
      .map((r) => r.id);
    if (oldIds.length) {
      const { error: delErr } = await supabase
        .from("facilities_house_occupancy")
        .delete()
        .in("id", oldIds);
      if (delErr) throw new Error(`clear occupancy: ${delErr.message}`);
    }
    const occRows = records.occupancy
      .map((o) => {
        const house_id = byLetter.get(string(o.house_letter).toUpperCase());
        if (!house_id) return null;
        return {
          house_id,
          period_start: o.period_start,
          period_end: o.period_end,
          occupant: o.occupant,
          notes: o.notes,
        };
      })
      .filter(Boolean);
    summary.occupancy = await insertBatched(supabase, "facilities_house_occupancy", occRows);
  }

  // Power — replace school rows so empty calendar seed is removed
  {
    const { error: delErr } = await supabase
      .from("facilities_power_usage")
      .delete()
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (delErr) throw new Error(`clear power: ${delErr.message}`);
    summary.power = await insertBatched(supabase, "facilities_power_usage", records.power);
  }

  // CCTV — replace school inventory
  {
    const { error: delErr } = await supabase
      .from("facilities_cctv")
      .delete()
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (delErr) throw new Error(`clear cctv: ${delErr.message}`);
    summary.cctv = await insertBatched(supabase, "facilities_cctv", records.cctv);
  }

  // Classroom items — replace school catalogue
  {
    const { error: delErr } = await supabase
      .from("facilities_classroom_items")
      .delete()
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (delErr) throw new Error(`clear classroom: ${delErr.message}`);
    summary.classroom = await insertBatched(
      supabase,
      "facilities_classroom_items",
      records.classroom,
    );
  }

  // SOPs — replace import-tagged rows for school
  {
    const { data: existing, error } = await supabase
      .from("facilities_sops")
      .select("id, content")
      .eq("school_id", USARIVER_SCHOOL_ID);
    if (error) throw new Error(`load sops: ${error.message}`);
    const oldIds = (existing ?? [])
      .filter((r) => string(r.content).includes(IMPORT_TAG))
      .map((r) => r.id);
    if (oldIds.length) {
      const { error: delErr } = await supabase.from("facilities_sops").delete().in("id", oldIds);
      if (delErr) throw new Error(`clear sops: ${delErr.message}`);
    }
    summary.sops = await insertBatched(supabase, "facilities_sops", records.sops);
  }

  return summary;
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

  console.log("Parsed Facilities Master:", {
    file: source,
    descriptorLines: records.descriptorCount,
    issues: records.issues.length,
    checklistScores: records.checklist.length,
    generatorLogs: records.generator.length,
    houses: records.houses.length,
    occupancy: records.occupancy.length,
    powerReadings: records.power.length,
    cctv: records.cctv.length,
    classroomItems: records.classroom.length,
    sops: records.sops.length,
  });
  console.log("Sample checklist:", records.checklist[0]);
  console.log("Sample generator:", records.generator[0]);

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
  const summary = await applyRecords(supabase, records);
  console.log("Imported:", summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
