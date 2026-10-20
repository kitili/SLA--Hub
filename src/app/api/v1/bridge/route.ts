import { hubApiJson, requireHubApiKey } from "@/lib/hub-api/auth";
import { bridgeFor, getSystemBridge } from "@/lib/system-bridge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const to = new URL(request.url).searchParams.get("to")?.trim() || "";
  try {
    const handoffs = await getSystemBridge();
    const data = to ? bridgeFor(handoffs, to) : handoffs.filter((row) => row.available);
    return hubApiJson({ ok: true, count: data.length, handoffs: data });
  } catch (error) {
    console.error("[hub-bridge]", error instanceof Error ? error.name : "error");
    return hubApiJson({ ok: false, error: "The desk bridge is unavailable right now." }, 502);
  }
}
