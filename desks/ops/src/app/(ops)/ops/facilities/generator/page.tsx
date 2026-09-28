import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import {
  listGeneratorLogs,
  probeFacilitiesAccess,
  type GeneratorLog,
} from "@/lib/db/facilities";
import { ScoreLogClient, type ScoreEntry } from "@/components/facilities/ScoreLogClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";

/**
 * Exact tasks from the Usa River master sheet's "2. Generator Checklist"
 * tab, in sheet order. The source sheet has a stray "Fuel/Water Separation"
 * spelling in a couple of month blocks — this uses the sheet's own header
 * spelling, "Fuel/Water Separator", as the single canonical value.
 */
const GENERATOR_TASK_OPTIONS = [
  "Visual Inspection",
  "Fuel Level",
  "Oil Level",
  "Coolant Level",
  "Battery Charge",
  "Engine Start",
  "Noise Level",
  "Fuel/Water Separator",
  "Exhaust System",
  "Electrical Connections",
  "Safety Shutdowns",
  "Documentation",
];

function toEntry(g: GeneratorLog): ScoreEntry {
  return {
    id: g.id,
    school_id: g.school_id,
    label: g.task,
    date: g.log_date,
    score: g.score,
    comments: g.comments,
    inspector: g.inspector,
  };
}

export default async function FacilitiesGeneratorPage() {
  const [schools, logs, loadError] = await Promise.all([
    getSchools(),
    listGeneratorLogs(),
    probeFacilitiesAccess(),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Generator Checklist</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>2. Generator Checklist</em> — task × day score matrix. Filter
            by month to match the stacked month blocks in Excel.
          </p>
        </div>
        <Link
          href="/ops/facilities"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Facilities
        </Link>
      </div>

      <FacilitiesSubnav active="generator" />
      <ScoreLogClient
        title="Generator Checklist"
        itemLabel="Task"
        itemOptions={GENERATOR_TASK_OPTIONS}
        apiPath="/api/facilities/generator-log"
        labelBodyKey="task"
        dateBodyKey="logDate"
        schools={schools}
        initialEntries={logs.map(toEntry)}
        loadError={logs.length === 0 ? loadError : null}
      />
    </div>
  );
}
