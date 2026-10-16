import { loadJourneyFeed } from "@/lib/hub-api/feeds";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  try {
    const data = await loadJourneyFeed();
    return hubApiJson({
      ok: true,
      source: "sla-hub",
      generatedAt: new Date().toISOString(),
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("hub-api journey", err);
    return hubApiJson({ ok: false, error: "Journey feed is unavailable right now." }, 502);
  }
}
