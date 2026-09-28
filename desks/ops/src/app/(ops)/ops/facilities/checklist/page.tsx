import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import {
  findRepeatedLowChecklistAlerts,
  listChecklistScores,
  probeFacilitiesAccess,
  type ChecklistScore,
} from "@/lib/db/facilities";
import { ScoreLogClient, type ScoreEntry } from "@/components/facilities/ScoreLogClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

/**
 * Exact area + descriptor pairs from the Usa River master sheet's hidden
 * "Copy of 1. Checklist" tab, in sheet order — Kusaduka fills these off the
 * paper process Baraka laid out, not free text. Do not add/reword values
 * without checking the source sheet first.
 */
const CHECKLIST_AREA_OPTIONS = [
  "Exterior Areas: Check the condition of outdoor play equipment for any damage or safety hazards.",
  "Exterior Areas: Inspect the cleanliness of the playground surfaces.",
  "Exterior Areas: Ensure that pathways are clear of debris and obstacles.",
  "Exterior Areas: Verify that outdoor seating areas/grounds  are clean and in good condition.",
  "Building Exterior: Inspect the condition of external walls, windows, and doors for any signs of damage or wear.",
  "Building Exterior: Check for any leaks or damage to the roof and ceiling",
  "Building Exterior: Ensure that outdoor lighting is functional and provides adequate illumination.",
  "Entrances and Reception: Verify that entrance doors are functioning properly and secure when closed.",
  "Entrances and Reception: Check the cleanliness and organization of reception areas.",
  "Entrances and Reception: Ensure that signage is clear and visible for visitors.",
  "Classrooms: Inspect classroom doors, windows, and furniture for any damage or maintenance issues.",
  "Classrooms: Check classroom floors for cleanliness and safety hazards.",
  "Classrooms: Verify that trash bins are emptied regularly and recycling procedures are followed.",
  "Hallways and Corridors: Verify that hallways are clear of clutter and obstruction.",
  "Hallways and Corridors: Check for any damage to walls, ceilings, or flooring.",
  "Restrooms: Inspect restroom facilities for cleanliness and sanitation.",
  "Restrooms: Check for any leaks or malfunctions in plumbing fixtures.",
  "Restrooms: Ensure that adequate supplies such as soap, water buckets, toilet cups and toilet paper are available.",
  "Common Areas: Check the cleanliness and organization of shared spaces such as dining and assembly areas.",
  "Common Areas: Inspect seating areas for any damage or wear.",
  "Common Areas: Verify that trash bins are emptied regularly and recycling procedures are followed.",
  "Maintenance Rooms and Storage Areas: Inspect maintenance rooms for cleanliness and organization. eg:",
  "Maintenance Rooms and Storage Areas: Check the inventory of supplies and equipment for cleaning, gardening, farm",
  "Maintenance Rooms and Storage Areas: Ensure that hazardous materials are stored safely and labeled properly.",
  "Safety and Security: Inspect security cameras and alarm systems for proper functioning.",
  "Safety and Security: Ensure that all entry and exit points are secure.",
  "Grounds and Landscaping: Check irrigation systems for proper functioning.",
  "Grounds and Landscaping: Ensure that outdoor seating areas and grounds are clean and well-maintained.",
];

function toEntry(c: ChecklistScore): ScoreEntry {
  return {
    id: c.id,
    school_id: c.school_id,
    label: c.area,
    date: c.walkthrough_date,
    score: c.score,
    comments: c.comments,
    inspector: c.inspector,
  };
}

export default async function FacilitiesChecklistPage() {
  const [schools, scores, loadError] = await Promise.all([
    getSchools(),
    listChecklistScores(),
    probeFacilitiesAccess(),
  ]);
  const repeatedLowAlerts = findRepeatedLowChecklistAlerts(scores, schools);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Weekly Checklist</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Usa River sheet tab <em>1. Checklist</em> — area × week score matrix (1–5), including
            descriptors from the hidden “+” copy sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportCsvButton entity="facilities-checklist" label="Export checklist" />
          <Link
            href="/ops/facilities"
            className="text-sm font-semibold text-electric-blue no-underline hover:underline"
          >
            ← Facilities
          </Link>
        </div>
      </div>

      <FacilitiesSubnav active="checklist" />
      {repeatedLowAlerts.length > 0 ? (
        <section className="mb-4 rounded-[var(--radius)] border border-gold/50 bg-gold-15 px-4 py-3 text-sm text-ink">
          <p className="font-semibold text-ink">Repeated low scores need attention</p>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {repeatedLowAlerts.slice(0, 4).map((alert) => (
              <li key={`${alert.school_id ?? "none"}-${alert.area}`}>
                {alert.school_name} · {alert.area} has {alert.streak} scores at or below 3 in a row.
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ScoreLogClient
        title="Weekly Checklist"
        itemLabel="Area / descriptor"
        itemOptions={CHECKLIST_AREA_OPTIONS}
        apiPath="/api/facilities/checklist"
        labelBodyKey="area"
        dateBodyKey="walkthroughDate"
        schools={schools}
        initialEntries={scores.map(toEntry)}
        loadError={scores.length === 0 ? loadError : null}
        defaultView="list"
        defaultListOrder="latest"
      />
    </div>
  );
}
