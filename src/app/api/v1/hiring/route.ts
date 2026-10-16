import { loadHiringFeed } from "@/lib/hub-api/feeds";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  try {
    const feed = await loadHiringFeed();
    return hubApiJson({
      ok: true,
      source: "sla-hub",
      generatedAt: new Date().toISOString(),
      count: feed.data.length,
      stages: feed.stages,
      data: feed.data,
    });
  } catch (err) {
    console.error("hub-api hiring", err);
    return hubApiJson({ ok: false, error: "Hiring feed is unavailable right now." }, 502);
  }
}
