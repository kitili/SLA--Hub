import { getWorkplacePerson } from "@/lib/workplace-people";
import { hubApiJson, hubApiOptions, requireHubApiKey } from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return hubApiOptions();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  const { email } = await params;
  const person = await getWorkplacePerson(decodeURIComponent(email));
  if (!person) {
    return hubApiJson({ ok: false, error: "Person not found" }, 404);
  }

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    data: {
      id: person.email,
      email: person.email,
      fullName: person.fullName,
      jobTitle: person.jobTitle,
      campus: person.campus,
      apps: person.apps,
      lastSeen: person.lastSeen,
    },
  });
}
