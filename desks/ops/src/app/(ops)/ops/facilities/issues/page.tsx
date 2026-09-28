import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listIssues, probeFacilitiesAccess } from "@/lib/db/facilities";
import { listProfileLabels } from "@/lib/db/profile-labels";
import { IssuesClient } from "@/components/facilities/IssuesClient";
import { FacilitiesSubnav } from "@/components/facilities/FacilitiesSubnav";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

export default async function FacilitiesIssuesPage() {
  const [schools, issues, loadError] = await Promise.all([
    getSchools(),
    listIssues(),
    probeFacilitiesAccess(),
  ]);
  const profileLabels = await listProfileLabels(
    issues.flatMap((i) => [i.created_by, i.updated_by]),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Facilities R&amp;M</h1>
          <p className="mt-2 max-w-xl text-ink-muted">
            Live R&amp;M tracker — repair tickets with accountable, responsible, deadlines,
            and days to close. Edits show who last changed each ticket.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportCsvButton entity="facilities-issues" label="Export R&amp;M" />
          <Link
            href="/ops/facilities"
            className="text-sm font-semibold text-electric-blue no-underline hover:underline"
          >
            ← Facilities
          </Link>
        </div>
      </div>

      <FacilitiesSubnav active="issues" />
      <IssuesClient
        schools={schools}
        initialIssues={issues}
        loadError={issues.length === 0 ? loadError : null}
        profileLabels={profileLabels}
      />
    </div>
  );
}
