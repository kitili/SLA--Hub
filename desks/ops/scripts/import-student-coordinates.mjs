#!/usr/bin/env node
/**
 * Import student pickup coordinates from the "Transport Users" sheet tab
 * (data/sheet_import/gid_2024890881.csv, refresh via fetch-sheet-tabs.py)
 * into real stops + route_stops + student_stop_assignments.
 *
 * Dry-run by default — prints a match report only, writes nothing.
 * Pass --apply to actually write.
 *
 * Matching is exact-only (normalized name / route comparison). Anything
 * that doesn't match cleanly is reported, never guessed.
 *
 * Usage:
 *   node scripts/import-student-coordinates.mjs
 *   node scripts/import-student-coordinates.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SHEET_PATH = resolve(
  process.cwd(),
  "data/sheet_import/gid_2024890881.csv",
);

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

/** Full-text CSV parser (handles quoted fields with embedded commas/newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Explicit sheet-label -> real route-name mapping, confirmed independently
 * by both Irene and Jfree (he derived it separately from block position +
 * bus-code suffix, cross-referenced against each bus's real route).
 *
 * The last four were flagged "missing" in an earlier pass, but Jfree
 * confirmed they're not gaps — the sheet label just doesn't textually
 * resemble the real route name. Notably "AM MOSHONO (DKS)" maps to
 * "Njiro", NOT "East Africa - Moshono" (a real, separate Usariver route
 * with a confusingly similar name) — do not let substring matching ever
 * cross-wire these two.
 */
const ROUTE_LABEL_MAP = new Map(
  [
    ["Kikatiti route DYW", "Kikatiti"],
    ["Nshupu Route  - EBP", "Nshupu via Usariver"],
    ["Kiwawa - APW", "Kiwawa"],
    ["Tengeru", "Tengeru"],
    ["Kambini - BHM", "Kambini"],
    ["Moshono - CPP", "East Africa - Moshono"],
    ["Sabato - BAE", "Sabato- Bango latigo"],
    ["Nkoaranga - BUF", "Nkoaranga"],
    ["MOROMBO ROUTE (EBM)", "Morombo"],
    ["AM SAKINA (CHE)", "Sakina"],
    ["AM NGARAMTONI (BMC)", "Ngaramtoni"],
    ["ILBORU (Normal route)", "Iliboru"],
    ["ILBORU - Back up)", "Iliboru"],
    ["KIJENGE", "Kijenge"],
    ["KIJENGE Back up", "Kijenge"],
    ["BOMA", "Sadala"],
    ["Mianzini - DDA", "Town - Sakina"],
    ["Ebenezer - DSD", "Maji ya chai Tuvaila"],
    ["Young Boys - BAE", "Ngongongare"],
    ["AM MOSHONO (DKS)", "Njiro"],
  ].map(([label, routeName]) => [normalize(label), normalize(routeName)]),
);

/** Arusha region roughly spans lat -6..-1, lng 34..39 (per Jfree — tighter
 * and more reliable than a Tanzania-wide box for this specific dataset).
 * Anything outside this is a parsing/data artifact, not a real pickup point. */
function isPlausibleTanzaniaCoord(lat, lng) {
  return lat >= -6 && lat <= -1 && lng >= 34 && lng <= 39;
}

/**
 * Try to read a "lat, lng" decimal pair out of a raw cell. Returns null if the
 * cell isn't exactly two comma-separated numbers (e.g. a DMS string like
 * `3°21'37.6"S 36°51'55.4"E` has no comma and is rejected here, not parsed).
 */
function parseDecimalPair(raw) {
  const parts = (raw ?? "").trim().split(",").map((p) => p.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Walk the wide, repeating per-route blocks and pull out rows with a coordinate.
 *
 * Column position is found by CONTENT, not by trusting the "LAT/LONG" header
 * label — this sheet is inconsistent: some blocks have no LAT/LONG header at
 * all despite having the decimal pair one column past where the DMS text sits,
 * and at least one block ("Kiwawa - APW") has "LAT/LONG" labeling a DMS-format
 * column while the real decimal pair sits unlabeled right next to it. Scanning
 * for the first cell that actually parses as a plausible decimal pair sidesteps
 * both problems.
 */
function extractSheetRows(rows) {
  const topRow = rows[0] ?? [];
  const header = rows[1] ?? [];
  const nameCols = [];
  header.forEach((h, i) => {
    if (h.trim() === "NAME OF STUDENT") nameCols.push(i);
  });

  const results = [];
  const implausible = [];
  for (const nc of nameCols) {
    let routeLabel = "";
    for (let j = nc; j >= 0; j--) {
      if (topRow[j] && topRow[j].trim()) {
        routeLabel = topRow[j].trim();
        break;
      }
    }

    const windowEnd = Math.min(nc + 14, header.length);

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (nc >= row.length) continue;
      const name = (row[nc] ?? "").trim();
      if (!name || /^(NAME OF STUDENT|STATUS)$/i.test(name)) continue;

      let found = null;
      for (let j = nc; j < Math.min(windowEnd, row.length); j++) {
        const pair = parseDecimalPair(row[j]);
        if (pair) {
          found = pair;
          break;
        }
      }
      if (!found) continue;
      const { lat, lng } = found;
      if (!isPlausibleTanzaniaCoord(lat, lng)) {
        implausible.push({ name, routeLabel, lat, lng });
        continue;
      }
      results.push({ name, routeLabel, lat, lng });
    }
  }
  return { results, implausible };
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

  if (!existsSync(SHEET_PATH)) {
    console.error(
      `Sheet export not found at ${SHEET_PATH}. Run scripts/fetch-sheet-tabs.py first.`,
    );
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(SHEET_PATH, "utf8"));
  const { results: sheetRows, implausible } = extractSheetRows(rows);
  console.log(`Parsed ${sheetRows.length} sheet rows with a plausible coordinate.`);
  if (implausible.length) {
    console.log(
      `Rejected ${implausible.length} row(s) with an out-of-Tanzania coordinate (not written):`,
    );
    for (const r of implausible.slice(0, 15)) {
      console.log(`  - "${r.name}" (route "${r.routeLabel}"): ${r.lat}, ${r.lng}`);
    }
  }

  const [{ data: students, error: studentsErr }, { data: routes, error: routesErr }, { data: existing }] =
    await Promise.all([
      supabase.from("students").select("id, first_name, last_name, school_id"),
      supabase.from("routes").select("id, name, school_id"),
      supabase.from("student_stop_assignments").select("student_id"),
    ]);
  if (studentsErr) throw studentsErr;
  if (routesErr) throw routesErr;

  const alreadyAssigned = new Set((existing ?? []).map((a) => a.student_id));

  const studentByName = new Map();
  for (const s of students) {
    const key = normalize(`${s.first_name}${s.last_name}`);
    studentByName.set(key, studentByName.has(key) ? null : s);
  }

  const matched = [];
  const seenStudentIds = new Set();
  const unmatchedStudent = [];
  const ambiguousStudent = [];
  const unmatchedRoute = [];
  const alreadyDone = [];
  const duplicateRow = [];

  for (const row of sheetRows) {
    const student = studentByName.get(normalize(row.name));
    if (student === undefined) {
      unmatchedStudent.push(row);
      continue;
    }
    if (student === null) {
      ambiguousStudent.push(row);
      continue;
    }
    if (alreadyAssigned.has(student.id)) {
      alreadyDone.push({ row, student });
      continue;
    }
    if (seenStudentIds.has(student.id)) {
      duplicateRow.push(row);
      continue;
    }

    const routeKey = normalize(row.routeLabel);
    const mappedKey = ROUTE_LABEL_MAP.get(routeKey);
    let route = routes.find(
      (r) =>
        r.school_id === student.school_id &&
        normalize(r.name) === (mappedKey ?? routeKey),
    );
    if (!route) {
      unmatchedRoute.push(row);
      continue;
    }

    seenStudentIds.add(student.id);
    matched.push({ row, student, route });
  }

  console.log("\nMatch report:");
  console.log(`  matched, ready to assign: ${matched.length}`);
  console.log(`  already assigned (skip):  ${alreadyDone.length}`);
  console.log(`  duplicate sheet row:      ${duplicateRow.length}`);
  console.log(`  unmatched student name:   ${unmatchedStudent.length}`);
  console.log(`  ambiguous student name:   ${ambiguousStudent.length}`);
  console.log(`  unmatched route:          ${unmatchedRoute.length}`);

  const preview = (label, list, fmt) => {
    if (!list.length) return;
    console.log(`\n${label} (first 15):`);
    for (const item of list.slice(0, 15)) console.log(`  - ${fmt(item)}`);
  };
  preview("Unmatched student names", unmatchedStudent, (r) => `"${r.name}" (route "${r.routeLabel}")`);
  preview("Unmatched routes", unmatchedRoute, (r) => `"${r.routeLabel}" for "${r.name}"`);
  preview("Ambiguous (duplicate DB name) students", ambiguousStudent, (r) => `"${r.name}"`);

  if (!args.apply) {
    console.log(`\nDry run only — pass --apply to write ${matched.length} assignments.`);
    return;
  }

  console.log(`\nApplying ${matched.length} assignments...`);
  let ok = 0;
  let failed = 0;
  for (const { row, student, route } of matched) {
    const { data: stop, error: stopErr } = await supabase
      .from("stops")
      .insert({
        school_id: student.school_id,
        name: "Pickup point",
        lat: row.lat,
        lng: row.lng,
        kind: "pickup",
      })
      .select("id")
      .single();
    if (stopErr || !stop) {
      console.log(`  FAILED stop for ${row.name}: ${stopErr?.message}`);
      failed++;
      continue;
    }

    const { data: last } = await supabase
      .from("route_stops")
      .select("stop_order")
      .eq("route_id", route.id)
      .order("stop_order", { ascending: false })
      .limit(1);
    const nextOrder = (last?.[0]?.stop_order ?? -1) + 1;

    const { error: rsErr } = await supabase
      .from("route_stops")
      .insert({ route_id: route.id, stop_id: stop.id, stop_order: nextOrder });
    if (rsErr) {
      console.log(`  FAILED route_stops for ${row.name}: ${rsErr.message}`);
      failed++;
      continue;
    }

    const { error: assignErr } = await supabase
      .from("student_stop_assignments")
      .upsert(
        { student_id: student.id, stop_id: stop.id, route_id: route.id },
        { onConflict: "student_id,stop_id" },
      );
    if (assignErr) {
      console.log(`  FAILED assignment for ${row.name}: ${assignErr.message}`);
      failed++;
      continue;
    }

    ok++;
  }
  console.log(`\nDone. ${ok} assigned, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
