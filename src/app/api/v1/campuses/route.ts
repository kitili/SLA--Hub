import { listWorkplaceCampuses } from "@/lib/workplace-people";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const campuses = await listWorkplaceCampuses();
  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    count: campuses.length,
    data: campuses.map((name) => ({ id: name, name })),
  });
}
