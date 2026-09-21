export type CandidateStage =
  | "incomplete_application"
  | "new"
  | "culture_video_requested"
  | "culture_video_submitted"
  | "performance_task_requested"
  | "performance_task_submitted"
  | "online_interview_requested"
  | "in_person_interview_requested"
  | "hired"
  | "rejected";

export type PipelineAction =
  | "culture"
  | "performance"
  | "online_interview"
  | "in_person";

/** Logged to hiring_pipeline_events (includes HR-only actions). */
export type PipelineLogAction =
  | PipelineAction
  | "hired"
  | "rejected"
  | "update"
  | "complete_application"
  | "it_onboarding_submitted"
  | "welcome_email_sent";

export type CandidateOutcome = "hired" | "rejected";

export type StageMarker = "NEXT" | "SENT";

export type Candidate = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  preferred_email: string | null;
  linkedin: string | null;
  cv_link: string | null;
  role_applied: string;
  application_check: string;
  stage: CandidateStage;
  culture_marker: StageMarker | null;
  culture_video_link: string | null;
  culture_video_feedback: string | null;
  culture_token: string | null;
  performance_marker: StageMarker | null;
  performance_task_sent_at: string | null;
  performance_task_link: string | null;
  performance_task_submitted: string | null;
  performance_token: string | null;
  notes: string | null;
  it_onboarding_token: string | null;
  it_onboarding_expires_at: string | null;
  work_email: string | null;
  it_submitted_at: string | null;
  welcome_email_sent_at: string | null;
};

export const STAGE_LABELS: Record<CandidateStage, string> = {
  incomplete_application: "Incomplete Application",
  new: "New",
  culture_video_requested: "Culture Video Requested",
  culture_video_submitted: "Culture Video Submitted",
  performance_task_requested: "Performance Task Requested",
  performance_task_submitted: "Performance Task Submitted",
  online_interview_requested: "Online Interview Requested",
  in_person_interview_requested: "In-Person Interview Requested",
  hired: "Hired",
  rejected: "Rejected",
};

export const BOARD_COLUMNS: CandidateStage[] = [
  "new",
  "culture_video_requested",
  "culture_video_submitted",
  "performance_task_requested",
  "performance_task_submitted",
  "incomplete_application",
];

export function normalizeHiringEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function candidateEmail(c: Pick<Candidate, "preferred_email" | "email">) {
  return (c.preferred_email || c.email || "").trim();
}

/** Stages that satisfy the culture-video gate for performance advance. */
export const CULTURE_COMPLETE_STAGES: CandidateStage[] = [
  "culture_video_submitted",
  "performance_task_requested",
  "performance_task_submitted",
  "online_interview_requested",
  "in_person_interview_requested",
  "hired",
  "rejected",
];

/** Stages that satisfy the performance gate for online interview. */
export const PERFORMANCE_COMPLETE_STAGES: CandidateStage[] = [
  "performance_task_submitted",
  "online_interview_requested",
  "in_person_interview_requested",
  "hired",
  "rejected",
];

/** Stages that satisfy the online-interview gate for in-person advance. */
export const ONLINE_INTERVIEW_STAGES: CandidateStage[] = [
  "online_interview_requested",
  "in_person_interview_requested",
  "hired",
  "rejected",
];

export function applicationCheck(linkedin?: string | null, cvLink?: string | null) {
  const hasLi = Boolean(linkedin?.trim());
  const hasCv = Boolean(cvLink?.trim());
  if (!hasLi && !hasCv) return "Missing CV + LinkedIn";
  if (!hasLi) return "Missing LinkedIn";
  if (!hasCv) return "Missing CV";
  return "OK";
}

export function addWorkingDays(start: Date, daysToAdd: number) {
  const d = new Date(start);
  let added = 0;
  while (added < daysToAdd) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function formatDateForEmail(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}
