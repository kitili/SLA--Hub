#!/usr/bin/env node
/**
 * Imports the structured, current records from the Usa River Farm Master workbook.
 *
 * Default: dry-run (prints what would be inserted).
 * Apply:   node scripts/import-usa-river-farm-master.mjs --apply
 * Source:  /home/kiki/Downloads/2026 Farms Master sheet - Usa River Campus .xlsx
 *
 * Intentionally imports only sheets with unambiguous records:
 * - 2) Site Utilisation & Staging → plots + current crop plantings
 * - 8) TASKS                    → farm activities
 * - 6) Farm expenses            → farm expenses
 * - Farm Walkthrough Data       → weekly walkthroughs
 * - 7) Crops Inventory          → input catalogue
 * - 4) 2026 Farming Schedules   → plot sections + weekly plan
 *
 * Historic P&Ls and mixed projection worksheets are retained in the workbook
 * because their date/crop/amount relationships cannot be mapped safely.
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const DEFAULT_FILE =
  "/home/kiki/Downloads/2026 Farms Master sheet - Usa River Campus .xlsx";
const IMPORT_TAG = "[Imported: Usa River Farm Master 2026]";

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
  const parsed = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel stores a date without a timezone. Converting with toISOString()
    // shifts Tanzanian date-only values back one day, so preserve local fields.
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

function findHeader(rows, requiredLabels) {
  return rows.findIndex((row) =>
    requiredLabels.every((label) =>
      row.some((cell) => string(cell).toLowerCase().includes(label.toLowerCase())),
    ),
  );
}

function columnIndex(row, label) {
  return row.findIndex((cell) =>
    string(cell).toLowerCase().includes(label.toLowerCase()),
  );
}

function statusForUsage(stage, inUse) {
  if (string(inUse).toLowerCase() === "yes" || string(stage).toUpperCase() === "ON") {
    return "active";
  }
  return "fallow";
}

function activityType(title) {
  const text = title.toLowerCase();
  if (text.includes("plant")) return "plant";
  if (text.includes("weed")) return "weed";
  if (text.includes("fertili")) return "fertilize";
  if (text.includes("water") || text.includes("irrigat")) return "irrigate";
  if (text.includes("harvest") || text.includes("pluck")) return "harvest";
  if (text.includes("prepar") || text.includes("ridge")) return "prep";
  if (text.includes("inspect") || text.includes("pest")) return "inspect";
  return "other";
}

function activityStatus(value) {
  const text = string(value).toLowerCase();
  if (text.includes("complete") || text.includes("done")) return "done";
  if (text.includes("progress")) return "in_progress";
  if (text.includes("skip")) return "skipped";
  return "pending";
}

function expenseCategory(description) {
  const text = description.toLowerCase();
  if (text.includes("seed") || text.includes("seedling")) return "seed";
  if (text.includes("fertili")) return "fertilizer";
  if (text.includes("labour") || text.includes("labor") || text.includes("weeding")) return "labor";
  if (text.includes("water") || text.includes("irrigat")) return "irrigation";
  if (text.includes("pest") || text.includes("insect")) return "pest_control";
  if (text.includes("tool") || text.includes("tractor")) return "tools";
  return "other";
}

const MONTHS = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};

const STAGE_CODES = new Set(["ON", "OFF", "FPR", "PLT", "WDN", "INS", "FTL", "HVT"]);

function normalizeStage(value) {
  const raw = string(value).toUpperCase();
  if (!raw) return null;
  if (raw === "FLT") return "FTL";
  if (raw === "WND") return "WDN";
  return STAGE_CODES.has(raw) ? raw : null;
}

function parentPlotCode(sectionCode) {
  const match = string(sectionCode).toUpperCase().match(/^([A-Z]+)/);
  return match?.[1] ?? null;
}

function weekOf(year, month, weekNumber) {
  const day = 1 + (weekNumber - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function loadSchedule(workbook) {
  const rows = rowsFor(workbook, "4) 2026 Farming Schedules");
  const headerIdx = rows.findIndex(
    (row) => string(row[0]).toLowerCase() === "plot" && string(row[1]).toLowerCase().includes("farm size"),
  );
  if (headerIdx < 0) throw new Error("Could not locate 2026 Farming Schedules header");
  const monthRow = rows[headerIdx];
  const weekRow = rows[headerIdx + 1];
  let currentMonth = null;
  const columns = [];
  for (let i = 0; i < Math.max(monthRow.length, weekRow.length); i += 1) {
    const monthLabel = string(monthRow[i]).toUpperCase();
    if (MONTHS[monthLabel]) currentMonth = MONTHS[monthLabel];
    const weekLabel = string(weekRow[i]).toUpperCase();
    const weekMatch = weekLabel.match(/^W([1-4])$/);
    if (currentMonth && weekMatch) {
      columns.push({
        index: i,
        week_of: weekOf(2026, currentMonth, Number(weekMatch[1])),
      });
    }
  }

  const sections = [];
  const weeks = [];
  for (const row of rows.slice(headerIdx + 2)) {
    const code = string(row[0]).toUpperCase();
    if (!/^[A-Z]+\d*$/.test(code) || STAGE_CODES.has(code)) continue;
    const plotCode = parentPlotCode(code);
    if (!plotCode) continue;
    const acreage = number(row[1]);
    const crop = string(row[2]) || null;
    sections.push({
      code,
      plot_code: plotCode,
      acreage,
      name: crop,
      notes: `${IMPORT_TAG} Section from 2026 Farming Schedules.`,
    });
    for (const column of columns) {
      const stage = normalizeStage(row[column.index]);
      if (!stage) continue;
      weeks.push({
        section_code: code,
        week_of: column.week_of,
        stage_code: stage,
        notes: IMPORT_TAG,
      });
    }
  }
  return { sections, weeks };
}

function loadRecords(workbook) {
  const plots = [];
  const plantings = [];
  const activities = [];
  const expenses = [];
  const walkthroughs = [];
  const inputs = [];

  const staging = rowsFor(workbook, "2) Site Utilisation & Staging");
  const stagingHeader = findHeader(staging, ["Plot", "Area", "Crop"]);
  if (stagingHeader < 0) {
    throw new Error('Could not locate headers in "2) Site Utilisation & Staging"');
  }
  const stagingColumns = staging[stagingHeader];
  const plotColumn = columnIndex(stagingColumns, "Plot");
  const acreageColumn = columnIndex(stagingColumns, "Area");
  const cropColumn = columnIndex(stagingColumns, "Crop");
  const stageColumn = columnIndex(stagingColumns, "Current Stage");
  const usedColumn = columnIndex(stagingColumns, "Currently Used");
  for (const row of staging.slice(stagingHeader + 1)) {
    const code = string(row[plotColumn]);
    if (!/^[A-Z]\d?$/.test(code)) continue;
    const acreage = number(row[acreageColumn]);
    const crop = string(row[cropColumn]);
    const stage = string(row[stageColumn]);
    const inUse = string(row[usedColumn]);
    if (acreage == null) continue;
    plots.push({
      code,
      name: `Farm ${code}`,
      acreage,
      status: statusForUsage(stage, inUse),
      notes: `${IMPORT_TAG} Current stage: ${stage || "not recorded"}; in use: ${inUse || "not recorded"}.`,
    });
    if (crop) {
      plantings.push({
        plot_code: code,
        crop,
        status: stage.toUpperCase() === "ON" ? "growing" : "planned",
        notes: `${IMPORT_TAG} Current crop imported from Site Utilisation & Staging.`,
      });
    }
  }

  const taskRows = rowsFor(workbook, "8) TASKS");
  const taskHeader = findHeader(taskRows, ["Task", "Current Status", "Deadline"]);
  for (const row of taskRows.slice(taskHeader + 1)) {
    const title = string(row[1]);
    if (!title) continue;
    const dueOn = isoDate(row[3]);
    const area = string(row[4]);
    const assignee = string(row[5]);
    const notes = [string(row[6]), string(row[7]), IMPORT_TAG]
      .filter(Boolean)
      .join("\n");
    activities.push({
      title,
      due_on: dueOn,
      assignee: assignee || null,
      activity_type: activityType(title),
      status: activityStatus(row[2]),
      completed_at: activityStatus(row[2]) === "done" ? dueOn : null,
      area,
      notes,
    });
  }

  const expenseRows = rowsFor(workbook, "6) Farm expenses");
  const expenseHeader = findHeader(expenseRows, ["Date", "Description", "Cost"]);
  for (const row of expenseRows.slice(expenseHeader + 1)) {
    const spentOn = isoDate(row[0]);
    const description = string(row[1]);
    const amount = number(row[2]);
    if (!spentOn || !description || amount == null || amount <= 0) continue;
    expenses.push({
      category: expenseCategory(description),
      amount,
      currency: "TZS",
      spent_on: spentOn,
      notes: `${IMPORT_TAG} ${description}`,
    });
  }

  const walkRows = rowsFor(workbook, "Farm Walkthrough Data");
  const walkHeader = findHeader(walkRows, ["# of Farms Checked", "Weekly Score"]);
  for (const row of walkRows.slice(walkHeader + 1)) {
    const weekOf = isoDate(row[0]);
    const score = number(row[9]);
    if (!weekOf || score == null) continue;
    walkthroughs.push({
      week_of: weekOf,
      overall_score: score,
      checklist: {
        farms_checked: number(row[1]),
        crops_as_expected: number(row[2]),
        stage_as_expected: number(row[3]),
        pests_checked: number(row[4]),
        pesticide_needed: number(row[5]),
        weeds_checked: number(row[6]),
        weeding_needed: number(row[7]),
        completion_ratio: number(row[8]),
      },
      notes: IMPORT_TAG,
    });
  }

  const cropRows = rowsFor(workbook, "7) Crops Inventory");
  for (const row of cropRows.slice(2)) {
    const name = string(row[1]);
    const unit = string(row[2]);
    if (!name || !unit || name.toLowerCase().includes("item name")) continue;
    inputs.push({
      name,
      unit,
      quantity_on_hand: 0,
      reorder_threshold: 0,
      notes: `${IMPORT_TAG} Catalogue item; stock not recorded in workbook.`,
    });
  }

  const schedule = loadSchedule(workbook);
  return {
    plots,
    plantings,
    activities,
    expenses,
    walkthroughs,
    inputs,
    sections: schedule.sections,
    scheduleWeeks: schedule.weeks,
  };
}

async function main() {
  if (!existsSync(source)) throw new Error(`Workbook not found: ${source}`);
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Keep Excel date serials intact. `cellDates: true` constructs JS Date objects
  // at UTC midnight and shifts the calendar date in the server timezone.
  const workbook = XLSX.readFile(source, { cellDates: false });
  const records = loadRecords(workbook);
  const summary = Object.fromEntries(
    Object.entries(records).map(([key, rows]) => [key, rows.length]),
  );
  console.log("Usa River Farm Master import summary:", summary);
  console.log(apply ? "Applying records…" : "Dry run only. Use --apply to write.");
  if (!apply) return;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: plotError } = await supabase
    .from("farm_plots")
    .upsert(records.plots, { onConflict: "code" });
  if (plotError) throw new Error(`farm_plots: ${plotError.message}`);

  const { data: dbPlots, error: dbPlotError } = await supabase
    .from("farm_plots")
    .select("id, code");
  if (dbPlotError) throw new Error(`load plots: ${dbPlotError.message}`);
  const plotIdByCode = new Map((dbPlots ?? []).map((plot) => [plot.code, plot.id]));

  const { data: oldPlantings, error: oldPlantingsError } = await supabase
    .from("farm_crop_plantings")
    .select("plot_id, crop");
  if (oldPlantingsError) throw new Error(`load plantings: ${oldPlantingsError.message}`);
  const plantingKeys = new Set(
    (oldPlantings ?? []).map((row) => `${row.plot_id}:${row.crop.toLowerCase()}`),
  );
  const newPlantings = records.plantings
    .map((planting) => ({
      ...planting,
      plot_id: plotIdByCode.get(planting.plot_code),
    }))
    .filter((planting) => planting.plot_id)
    .filter((planting) => !plantingKeys.has(`${planting.plot_id}:${planting.crop.toLowerCase()}`))
    .map((planting) => ({
      plot_id: planting.plot_id,
      crop: planting.crop,
      status: planting.status,
      notes: planting.notes,
    }));
  if (newPlantings.length) {
    const { error } = await supabase.from("farm_crop_plantings").insert(newPlantings);
    if (error) throw new Error(`farm_crop_plantings: ${error.message}`);
  }

  const { data: oldActivities, error: oldActivitiesError } = await supabase
    .from("farm_activities")
    .select("title")
    .ilike("notes", `%${IMPORT_TAG}%`);
  if (oldActivitiesError) throw new Error(`load activities: ${oldActivitiesError.message}`);
  const activityTitles = new Set((oldActivities ?? []).map((row) => row.title));
  const newActivities = records.activities
    .filter((activity) => !activityTitles.has(activity.title))
    .map(({ area, ...activity }) => ({
      ...activity,
      plot_id: plotIdByCode.get(area.replace(/^Farm\s+/i, "").slice(0, 1)) ?? null,
    }));
  if (newActivities.length) {
    const { error } = await supabase.from("farm_activities").insert(newActivities);
    if (error) throw new Error(`farm_activities: ${error.message}`);
  }

  const { data: oldExpenses, error: oldExpensesError } = await supabase
    .from("farm_expenses")
    .select("spent_on, amount");
  if (oldExpensesError) throw new Error(`load expenses: ${oldExpensesError.message}`);
  const expenseKeys = new Set(
    (oldExpenses ?? []).map((row) => `${row.spent_on}:${row.amount}`),
  );
  const newExpenses = records.expenses.filter(
    (expense) => !expenseKeys.has(`${expense.spent_on}:${expense.amount}`),
  );
  if (newExpenses.length) {
    const { error } = await supabase.from("farm_expenses").insert(newExpenses);
    if (error) throw new Error(`farm_expenses: ${error.message}`);
  }

  const { data: oldWalkthroughs, error: oldWalkthroughsError } = await supabase
    .from("farm_walkthroughs")
    .select("week_of");
  if (oldWalkthroughsError) throw new Error(`load walkthroughs: ${oldWalkthroughsError.message}`);
  const weeks = new Set((oldWalkthroughs ?? []).map((row) => row.week_of));
  const newWalkthroughs = records.walkthroughs.filter((row) => !weeks.has(row.week_of));
  if (newWalkthroughs.length) {
    const { error } = await supabase.from("farm_walkthroughs").insert(newWalkthroughs);
    if (error) throw new Error(`farm_walkthroughs: ${error.message}`);
  }

  const { data: oldInputs, error: oldInputsError } = await supabase
    .from("farm_inputs")
    .select("name");
  if (oldInputsError) throw new Error(`load inputs: ${oldInputsError.message}`);
  const inputNames = new Set((oldInputs ?? []).map((row) => row.name.toLowerCase()));
  const newInputs = records.inputs.filter((input) => !inputNames.has(input.name.toLowerCase()));
  if (newInputs.length) {
    const { error } = await supabase.from("farm_inputs").insert(newInputs);
    if (error) throw new Error(`farm_inputs: ${error.message}`);
  }

  const sectionRows = records.sections
    .map((section) => ({
      ...section,
      plot_id: plotIdByCode.get(section.plot_code),
    }))
    .filter((section) => section.plot_id)
    .map(({ plot_code: _plotCode, ...section }) => ({
      plot_id: section.plot_id,
      code: section.code,
      name: section.name,
      acreage: section.acreage,
      notes: section.notes,
    }));
  if (sectionRows.length) {
    const { error } = await supabase
      .from("farm_plot_sections")
      .upsert(sectionRows, { onConflict: "plot_id,code" });
    if (error) throw new Error(`farm_plot_sections: ${error.message}`);
  }

  const { data: dbSections, error: dbSectionsError } = await supabase
    .from("farm_plot_sections")
    .select("id, code");
  if (dbSectionsError) throw new Error(`load sections: ${dbSectionsError.message}`);
  const sectionIdByCode = new Map((dbSections ?? []).map((s) => [s.code, s.id]));

  const scheduleRows = records.scheduleWeeks
    .map((week) => ({
      section_id: sectionIdByCode.get(week.section_code),
      week_of: week.week_of,
      stage_code: week.stage_code,
      notes: week.notes,
    }))
    .filter((week) => week.section_id);
  if (scheduleRows.length) {
    const { error } = await supabase
      .from("farm_schedule_weeks")
      .upsert(scheduleRows, { onConflict: "section_id,week_of" });
    if (error) throw new Error(`farm_schedule_weeks: ${error.message}`);
  }

  console.log("Imported:", {
    plots: records.plots.length,
    plantings: newPlantings.length,
    activities: newActivities.length,
    expenses: newExpenses.length,
    walkthroughs: newWalkthroughs.length,
    inputs: newInputs.length,
    sections: sectionRows.length,
    scheduleWeeks: scheduleRows.length,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
