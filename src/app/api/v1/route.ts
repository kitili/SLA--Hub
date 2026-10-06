import { workplaceSystems } from "@/lib/workplace-systems";
import {
  hubApiOptions,
  hubApiJson,
  requireHubApiKey,
} from "@/lib/hub-api/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1 — catalog for ShuleOne and other machine clients.
 * Auth: Authorization: Bearer $HUB_API_KEY
 */
export function OPTIONS() {
  return hubApiOptions();
}

export function GET(request: Request) {
  const denied = requireHubApiKey(request);
  if (denied) return denied;

  return hubApiJson({
    ok: true,
    source: "sla-hub",
    generatedAt: new Date().toISOString(),
    purpose: "Read-only workplace data for ShuleOne. Email is the stable person key.",
    endpoints: [
      { method: "GET", path: "/api/v1", description: "This catalog" },
      {
        method: "GET",
        path: "/api/v1/people",
        description: "Everyone who has used a Silverleaf app",
        query: ["campus", "app", "q", "since", "limit", "offset"],
      },
      { method: "GET", path: "/api/v1/people/{email}", description: "One person by work email" },
      {
        method: "GET",
        path: "/api/v1/staff",
        description: "Onboarding staff records (no secrets)",
        query: ["campus", "q", "limit", "offset"],
      },
      { method: "GET", path: "/api/v1/campuses", description: "Campuses found on people records" },
      { method: "GET", path: "/api/v1/systems", description: "Workplace systems ShuleOne can map to" },
    ],
    systems: workplaceSystems.map((system) => system.id),
  });
}
