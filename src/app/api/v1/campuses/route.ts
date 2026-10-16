import { listWorkplaceCampuses } from "@/lib/workplace-people";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  let campuses;
  try {
    campuses = await listWorkplaceCampuses();
  } catch (err) {
    console.error("hub-api campuses", err);
    return hubApiJson({ ok: false, error: "Workplace campuses are unavailable right now." }, 502);
  }

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    count: campuses.length,
    data: campuses.map((name) => ({ id: name, name })),
  });
}
