import { loadCatalogFeed } from "@/lib/hub-api/feeds";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  try {
    const feed = await loadCatalogFeed();
    return hubApiJson({
      ok: true,
      source: "sla-hub",
      generatedAt: new Date().toISOString(),
      sectionCount: feed.sections.length,
      pdfCount: feed.pdfs.length,
      videoCount: feed.videos.length,
      sections: feed.sections,
      pdfs: feed.pdfs,
      videos: feed.videos,
    });
  } catch (err) {
    console.error("hub-api catalog", err);
    return hubApiJson({ ok: false, error: "Course catalog is unavailable right now." }, 502);
  }
}
