import { workplaceSystems } from "@/lib/workplace-systems";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    count: workplaceSystems.length,
    data: workplaceSystems.map((system) => ({
      id: system.id,
      name: system.name,
      lane: system.lane,
      liveUrl: system.liveUrl,
    })),
  });
}