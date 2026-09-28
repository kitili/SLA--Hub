// Live read of the "Transport Summary" tab in the master Google Sheet —
// same sheet scripts/fetch-sheet-tabs.py downloads, gid 1481461008.
//
// Occupancy and Incidents are computed from the app's own live data instead
// of the sheet (see computeDbOccupancyKpi / computeDbIncidentsKpi below) --
// their sheet rows are skipped when parsing. Bus Arrival Time / Transport
// P&L are still sheet-sourced until each has a real DB-computed equivalent
// (see the transport master-sheet gap-closing plan).
import { getBuses, getStudents } from "@/lib/db/queries";
import { computeFleetOccupancyPct } from "@/lib/dashboard/occupancy";
import { createClient } from "@/lib/supabase/server";

const SHEET_ID = "1BDkvHWhJnJXS9vx1c2reyXkab494ZF7bji8z76Ck-mw";
const SUMMARY_GID = "1481461008";
const OCCUPANCY_TARGET_PCT = 95;
const INCIDENTS_TARGET = 0;
const SKIP_SHEET_LABELS = new Set(["occupancy", "incidents"]);

export type CeoKpi = {
  label: string;
  target: number;
  actual: number;
  targetDisplay: string;
  actualDisplay: string;
  /** true = on/above target and that's good (or, for incidents, at/below target) */
  good: boolean;
};

export type CeoKpiResult = {
  kpis: CeoKpi[];
  /** Set when the sheet-sourced KPIs (Incidents / Bus Arrival Time / Transport
   * P&L) couldn't be loaded -- `kpis` may still contain the DB-computed
   * Occupancy KPI even when this is set, since that one doesn't depend on
   * the sheet at all. */
  error?: string;
};

// Incidents is the only "lower is better" KPI in this set.
const LOWER_IS_BETTER = new Set(["incidents"]);

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/%/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
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

async function computeDbOccupancyKpi(): Promise<CeoKpi> {
  const [buses, students] = await Promise.all([getBuses(), getStudents()]);
  const actual = computeFleetOccupancyPct(students.length, buses);
  return {
    label: "Occupancy",
    target: OCCUPANCY_TARGET_PCT,
    actual,
    targetDisplay: `${OCCUPANCY_TARGET_PCT}%`,
    actualDisplay: `${actual}%`,
    good: actual >= OCCUPANCY_TARGET_PCT,
  };
}

/** Year-to-date incident count -- same YTD convention already used for farm
 * P&L in super-admin-overview.ts (Jan 1 of the current year through today). */
async function computeDbIncidentsKpi(): Promise<CeoKpi> {
  const supabase = await createClient();
  const ytdFrom = `${new Date().getFullYear()}-01-01`;
  const { count, error } = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .gte("created_at", ytdFrom);
  const actual = error || count == null ? 0 : count;
  return {
    label: "Incidents",
    target: INCIDENTS_TARGET,
    actual,
    targetDisplay: INCIDENTS_TARGET.toFixed(2),
    actualDisplay: actual.toFixed(2),
    good: actual <= INCIDENTS_TARGET,
  };
}

function parseSheetKpis(text: string): CeoKpi[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const kpis: CeoKpi[] = [];

  for (const line of lines) {
    const cols = parseCsvLine(line);
    // KPI rows have the label in the second-to-last-3 slot pattern the
    // sheet uses: [...,"N. Label","Target","Actual",...]. Find any cell
    // matching "N. Label" and read the next two non-empty cells after it.
    const labelIdx = cols.findIndex((c) => /^\d+\.\s*.+/.test(c.trim()));
    if (labelIdx === -1) continue;
    const rawLabel = cols[labelIdx].replace(/^\d+\.\s*/, "").trim();
    if (!rawLabel) continue;
    const key = rawLabel.toLowerCase();
    if (SKIP_SHEET_LABELS.has(key)) continue;
    const rest = cols.slice(labelIdx + 1).filter((c) => c.trim() !== "");
    if (rest.length < 2) continue;
    const target = parseNumber(rest[0]);
    const actual = parseNumber(rest[1]);
    if (Number.isNaN(target) || Number.isNaN(actual)) continue;

    const lowerIsBetter = LOWER_IS_BETTER.has(key);
    const good = lowerIsBetter ? actual <= target : actual >= target;

    kpis.push({
      label: rawLabel,
      target,
      actual,
      targetDisplay: rest[0].trim(),
      actualDisplay: rest[1].trim(),
      good,
    });
    // The sheet has exactly 4 real numbered KPI rows; Occupancy and Incidents
    // are skipped above (computed from the DB instead), leaving 2 real ones
    // (Bus Arrival Time, Transport P&L). Capping at that real count -- not 4
    // -- matters: a looser cap would let spurious rows through (some other
    // cell in the sheet that coincidentally matches the "N. Label" pattern
    // but isn't a real KPI) now that 2 slots are freed up, not 1.
    if (kpis.length === 2) break;
  }

  return kpis;
}

export async function getTransportCeoKpis(): Promise<CeoKpiResult> {
  // Occupancy and Incidents come from the app's own data regardless of
  // whether the sheet is reachable -- neither depends on the sheet anymore.
  const [occupancyKpi, incidentsKpi] = await Promise.all([
    computeDbOccupancyKpi(),
    computeDbIncidentsKpi(),
  ]);
  const dbKpis = [occupancyKpi, incidentsKpi];

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SUMMARY_GID}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        kpis: dbKpis,
        error: `Sheet fetch failed (${res.status}) -- showing Occupancy/Incidents only`,
      };
    }
    const text = await res.text();
    const sheetKpis = parseSheetKpis(text);
    if (sheetKpis.length === 0) {
      return {
        kpis: dbKpis,
        error: "Could not find KPI rows in the sheet -- showing Occupancy/Incidents only",
      };
    }
    return { kpis: [...dbKpis, ...sheetKpis] };
  } catch {
    return {
      kpis: dbKpis,
      error: "Could not reach the master sheet -- showing Occupancy/Incidents only",
    };
  }
}
