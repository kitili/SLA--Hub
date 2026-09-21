import { describe, expect, it } from "vitest";

import type { HiringCandidate } from "@/lib/db/schema/hiring";

import { omitCandidateSecrets, toCandidate } from "./map-candidate";

function row(over: Partial<HiringCandidate> = {}): HiringCandidate {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "2c1a7e0a-3c4b-4d5e-8f90-123456789abc",
    createdAt: now,
    updatedAt: now,
    fullName: "Ada",
    email: "ada@example.com",
    preferredEmail: null,
    linkedin: null,
    cvLink: null,
    roleApplied: "Teacher",
    applicationCheck: "OK",
    stage: "new",
    cultureMarker: null,
    cultureVideoLink: null,
    cultureVideoFeedback: null,
    cultureToken: "culture-secret",
    performanceMarker: null,
    performanceTaskSentAt: null,
    performanceTaskLink: null,
    performanceTaskSubmitted: null,
    performanceToken: "perf-secret",
    performanceTaskId: null,
    performanceManagerEmail: null,
    notes: "Phone: +255…",
    itOnboardingToken: "it-secret",
    itOnboardingExpiresAt: null,
    workEmail: null,
    itSubmittedAt: null,
    welcomeEmailSentAt: null,
    ...over,
  };
}

describe("omitCandidateSecrets", () => {
  it("strips upload and onboarding tokens", () => {
    const candidate = omitCandidateSecrets(toCandidate(row()));
    expect(candidate.culture_token).toBeNull();
    expect(candidate.performance_token).toBeNull();
    expect(candidate.it_onboarding_token).toBeNull();
    expect(candidate.full_name).toBe("Ada");
    expect(candidate.notes).toBe("Phone: +255…");
  });
});
