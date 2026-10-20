import { hubApiJson, requireHubApiKey } from "@/lib/hub-api/auth";
import { LINK_KINDS, listSystemLinks, parseLinkInput, saveSystemLink } from "@/lib/system-links";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const kind = new URL(request.url).searchParams.get("kind");
  if (!kind || !LINK_KINDS.includes(kind as (typeof LINK_KINDS)[number])) {
    return hubApiJson(
      { ok: false, error: `kind must be one of: ${LINK_KINDS.join(", ")}` },
      400,
    );
  }

  try {
    const data = await listSystemLinks(kind as (typeof LINK_KINDS)[number]);
    return hubApiJson({ ok: true, kind, count: data.length, data });
  } catch (error) {
    console.error("[hub-links]", error instanceof Error ? error.name : "error");
    return hubApiJson({ ok: false, error: "System links are unavailable right now." }, 502);
  }
}

export async function POST(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return hubApiJson({ ok: false, error: "Send a JSON body." }, 400);
  }

  const input = parseLinkInput(body);
  if (!input) {
    return hubApiJson(
      { ok: false, error: `kind must be one of: ${LINK_KINDS.join(", ")}` },
      400,
    );
  }

  try {
    const saved = await saveSystemLink(input);
    return hubApiJson({ ok: true, id: saved.id, kind: saved.kind, createdAt: saved.createdAt }, 201);
  } catch (error) {
    console.error("[hub-links]", error instanceof Error ? error.name : "error");
    return hubApiJson({ ok: false, error: "System links are unavailable right now." }, 502);
  }
}
