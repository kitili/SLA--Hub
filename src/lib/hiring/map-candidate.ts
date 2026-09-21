import type { HiringCandidate } from "@/lib/db/schema/hiring";
import { decryptString } from "@/lib/security/encrypt";

import type { Candidate, CandidateStage, StageMarker } from "./types";

export function toCandidate(row: HiringCandidate): Candidate {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    full_name: row.fullName,
    email: row.email,
    preferred_email: row.preferredEmail,
    linkedin: row.linkedin,
    cv_link: row.cvLink,
    role_applied: row.roleApplied,
    application_check: row.applicationCheck,
    stage: row.stage as CandidateStage,
    culture_marker: (row.cultureMarker as StageMarker | null) ?? null,
    culture_video_link: row.cultureVideoLink,
    culture_video_feedback: decryptString(row.cultureVideoFeedback),
    culture_token: row.cultureToken,
    performance_marker: (row.performanceMarker as StageMarker | null) ?? null,
    performance_task_sent_at: row.performanceTaskSentAt?.toISOString() ?? null,
    performance_task_link: row.performanceTaskLink,
    performance_task_submitted: row.performanceTaskSubmitted,
    performance_token: row.performanceToken,
    notes: decryptString(row.notes),
    it_onboarding_token: row.itOnboardingToken ?? null,
    it_onboarding_expires_at: row.itOnboardingExpiresAt?.toISOString() ?? null,
    work_email: row.workEmail ?? null,
    it_submitted_at: row.itSubmittedAt?.toISOString() ?? null,
    welcome_email_sent_at: row.welcomeEmailSentAt?.toISOString() ?? null,
  };
}

/** Strip upload/onboarding tokens before sending a candidate to the browser. */
export function omitCandidateSecrets(candidate: Candidate): Candidate {
  return {
    ...candidate,
    culture_token: null,
    performance_token: null,
    it_onboarding_token: null,
  };
}

export function toClientCandidate(row: HiringCandidate): Candidate {
  return omitCandidateSecrets(toCandidate(row));
}
