import { listWorkplacePeople } from "@/lib/workplace-people";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";
import { readLimit, readOffset, readSince } from "@/lib/hub-api/query";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const search = new URL(request.url).searchParams;
  let people;
  try {
    people = await listWorkplacePeople({
      campus: search.get("campus") ?? undefined,
      app: search.get("app") ?? undefined,
      q: search.get("q") ?? undefined,
      since: readSince(search),
      emailOnly: true,
      limit: readLimit(search),
      offset: readOffset(search),
    });
  } catch (err) {
    console.error("hub-api people", err);
    return hubApiJson({ ok: false, error: "Workplace people are unavailable right now." }, 502);
  }

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    count: people.length,
    data: people.map((person) => ({
      id: person.email,
      email: person.email,
      fullName: person.fullName,
      jobTitle: person.jobTitle,
      campus: person.campus,
      apps: person.apps,
      lastSeen: person.lastSeen,
    })),
  });
}
