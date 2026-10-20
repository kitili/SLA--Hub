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
    purpose: "Workplace data for ShuleOne. Email is the stable person key. /api/v1/links is the mailbox Academics, Talent Academy, Ops, and Student Experience use to exchange insights.",
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
      {
        method: "GET",
        path: "/api/v1/journey",
        description: "Onboarding progress, bio status, sign-off, and feedback",
      },
      {
        method: "GET",
        path: "/api/v1/hiring",
        description: "Candidates with stage names and work email when hired",
      },
      { method: "GET", path: "/api/v1/tickets", description: "Open SLA-bot alarms and questions" },
      {
        method: "GET",
        path: "/api/v1/catalog",
        description: "Course sections, items, PDFs, and videos",
      },
      {
        method: "GET",
        path: "/api/v1/links",
        description: "Insights passed between systems",
        query: ["kind"],
      },
      {
        method: "POST",
        path: "/api/v1/links",
        description: "Send one insight. kind is ops.behaviour, academics.pd, or talent.training",
      },
    ],
    systems: workplaceSystems.map((system) => system.id),
  });
}
