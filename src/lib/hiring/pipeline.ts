import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  hiringCandidates,
  hiringPipelineEvents,
} from "@/lib/db/schema/hiring";
import { encryptString } from "@/lib/security/encrypt";

type PerformanceTaskInfo = {
  taskId: string;
  title: string;
  description: string | null;
  fileLink: string | null;
  managerEmail: string | null;
};

type LocationSchedule = {
  location: string;
  dateLabel: string;
  timeLabel: string;
  additionalAttendees?: string[];
};

import {
  buildCultureVideoEmail,
  buildHiredEmail,
  buildInPersonInterviewEmail,
  buildItOnboardingRequestEmail,
  buildItSubmissionNotificationEmail,
  buildOnlineInterviewEmail,
  buildPerformanceTaskEmail,
  buildRejectedEmail,
  buildWelcomeEmail,
  type EmailPhones,
} from "./email-templates";
import { getSetting } from "@/lib/app-settings";
import { createInterviewEvent } from "./google-calendar";
import { toCandidate, toClientCandidate } from "./map-candidate";
import {
  mapApplicationPayload,
  missingApplicationRequirements,
} from "./application-payload";
import { parseCsv } from "./csv";
import { sendHiringEmail, type EmailAttachment } from "./mail";
import {
  buildOnboardingUrl,
  buildUploadUrl,
  newOnboardingToken,
  newUploadToken,
} from "./tokens";
import {
  addWorkingDays,
  applicationCheck,
  candidateEmail,
  CULTURE_COMPLETE_STAGES,
  formatDateForEmail,
  normalizeHiringEmail,
  ONLINE_INTERVIEW_STAGES,
  PERFORMANCE_COMPLETE_STAGES,
  type Candidate,
  type CandidateOutcome,
  type CandidateStage,
  type PipelineAction,
  type PipelineLogAction,
} from "./types";
import { upsertStaffByEmail } from "@/lib/db/repositories/staff";

type AdvanceResult = {
  candidate: Candidate;
  emailStubbed: boolean;
  action: PipelineAction;
};

export type UpdateCandidateResult = {
  candidate: Candidate;
  advanced?: boolean;
  emailStubbed?: boolean;
};

export type OutcomeResult = {
  candidate: Candidate;
  emailStubbed?: boolean;
  staffProvisioned?: boolean;
};

function assertCanAdvance(candidate: Candidate, action: PipelineAction) {
  if (candidate.stage === "hired" || candidate.stage === "rejected") {
    throw new Error("Cannot advance a candidate with a final outcome.");
  }

  if (action === "performance" && !CULTURE_COMPLETE_STAGES.includes(candidate.stage)) {
    throw new Error(
      "Send the performance task only after the culture video is submitted.",
    );
  }

  if (
    action === "online_interview" &&
    !PERFORMANCE_COMPLETE_STAGES.includes(candidate.stage)
  ) {
    throw new Error(
      "Schedule an online interview only after the performance task is submitted.",
    );
  }

  if (
    action === "in_person" &&
    !ONLINE_INTERVIEW_STAGES.includes(candidate.stage)
  ) {
    throw new Error(
      "Schedule an in-person interview only after the online interview stage.",
    );
  }
}

async function getEmailPhones(): Promise<EmailPhones> {
  const [phone1, phone2] = await Promise.all([
    getSetting("contact_phone_1"),
    getSetting("contact_phone_2"),
  ]);
  return {
    phone1: phone1 || undefined,
    phone2: phone2 || undefined,
  };
}

function cultureDeadlineDays() {
  return Number(process.env.CULTURE_DEADLINE_WORKING_DAYS || 2);
}

function performanceDeadlineDays() {
  return Number(process.env.PERFORMANCE_DEADLINE_WORKING_DAYS || 3);
}

async function logEvent(params: {
  candidateId: string;
  action: PipelineLogAction;
  actorId?: string | null;
  detail?: string;
  emailTo?: string;
  emailSubject?: string;
  success: boolean;
}) {
  await db.insert(hiringPipelineEvents).values({
    candidateId: params.candidateId,
    action: params.action,
    actorId: params.actorId ?? null,
    detail: params.detail ?? null,
    emailTo: params.emailTo ?? null,
    emailSubject: params.emailSubject ?? null,
    success: params.success,
  });
}

async function findExistingCandidate(
  email: string,
  preferredEmail?: string,
) {
  const needles = [normalizeHiringEmail(email)];
  if (preferredEmail) needles.push(normalizeHiringEmail(preferredEmail));

  for (const needle of needles) {
    if (!needle) continue;
    const [byEmail] = await db
      .select()
      .from(hiringCandidates)
      .where(eq(hiringCandidates.email, needle))
      .limit(1);
    if (byEmail) return byEmail;
    const [byPreferred] = await db
      .select()
      .from(hiringCandidates)
      .where(eq(hiringCandidates.preferredEmail, needle))
      .limit(1);
    if (byPreferred) return byPreferred;
  }
  return null;
}

export async function ingestApplication(input: {
  fullName: string;
  email: string;
  preferredEmail?: string;
  linkedin?: string;
  cvLink?: string;
  roleApplied: string;
  notes?: string;
}) {
  const existing = await findExistingCandidate(input.email, input.preferredEmail);
  if (existing) {
    return {
      candidate: toCandidate(existing),
      advanced: false as const,
      duplicate: true as const,
    };
  }

  const check = applicationCheck(input.linkedin, input.cvLink);
  const incomplete = check !== "OK";

  const [row] = await db
    .insert(hiringCandidates)
    .values({
      fullName: input.fullName.trim(),
      email: normalizeHiringEmail(input.email),
      preferredEmail: input.preferredEmail
        ? normalizeHiringEmail(input.preferredEmail)
        : null,
      linkedin: input.linkedin?.trim() || null,
      cvLink: input.cvLink?.trim() || null,
      roleApplied: input.roleApplied.trim() || "General",
      applicationCheck: check,
      stage: incomplete ? "incomplete_application" : "new",
      notes: input.notes?.trim() ? encryptString(input.notes.trim()) : null,
    })
    .returning();

  if (!row) throw new Error("Failed to create candidate");

  return { candidate: toCandidate(row), advanced: false as const, duplicate: false as const };
}

export async function advanceStage(
  candidateId: string,
  action: PipelineAction,
  actorId?: string | null,
  schedule?: { startIso: string; endIso: string; dateLabel: string; timeLabel: string; additionalAttendees?: string[] } | null,
  locationSchedule?: LocationSchedule | null,
  performanceTask?: PerformanceTaskInfo | null,
): Promise<AdvanceResult> {
  const [row] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);

  if (!row) throw new Error("Candidate not found");

  const candidate = toCandidate(row);

  assertCanAdvance(candidate, action);

  if (action === "culture") return advanceCulture(candidate, actorId);
  if (action === "performance")
    return advancePerformance(candidate, actorId, performanceTask ?? null);
  if (action === "online_interview") {
    return advanceOnlineInterview(candidate, actorId, schedule ?? null);
  }
  if (action === "in_person")
    return advanceInPersonInterview(candidate, actorId, locationSchedule ?? null);

  throw new Error(`Unknown pipeline action: ${action}`);
}

async function advanceCulture(
  candidate: Candidate,
  actorId?: string | null,
  opts?: { force?: boolean },
): Promise<AdvanceResult> {
  if (!opts?.force && candidate.culture_marker === "SENT") {
    throw new Error("Culture stage already SENT. Clear the marker to re-send.");
  }

  const email = candidateEmail(candidate);
  if (!email) throw new Error("Candidate has no email.");

  const token = candidate.culture_token || newUploadToken();
  const uploadLink = buildUploadUrl(token, "culture");
  const deadline = formatDateForEmail(
    addWorkingDays(new Date(), cultureDeadlineDays()),
  );
  const subject = `Next Step: Culture Fit Video – ${candidate.role_applied}`;
  const phones = await getEmailPhones();
  const htmlBody = buildCultureVideoEmail(
    candidate.full_name,
    candidate.role_applied,
    uploadLink,
    deadline,
    phones,
  );

  const mail = await sendHiringEmail({ to: email, subject, htmlBody });
  if (!mail.ok) {
    await logEvent({
      candidateId: candidate.id,
      action: "culture",
      actorId,
      detail: mail.error,
      emailTo: email,
      emailSubject: subject,
      success: false,
    });
    throw new Error(mail.error || "Failed to send culture email");
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set({
      cultureToken: token,
      cultureMarker: "SENT",
      stage: "culture_video_requested",
      updatedAt: new Date(),
    })
    .where(eq(hiringCandidates.id, candidate.id))
    .returning();

  if (!updated) throw new Error("Failed to update candidate");

  await logEvent({
    candidateId: candidate.id,
    action: "culture",
    actorId,
    detail: mail.stubbed ? "email stubbed" : "email sent",
    emailTo: email,
    emailSubject: subject,
    success: true,
  });

  return {
    candidate: toCandidate(updated),
    emailStubbed: mail.stubbed,
    action: "culture",
  };
}

async function advancePerformance(
  candidate: Candidate,
  actorId?: string | null,
  task?: PerformanceTaskInfo | null,
): Promise<AdvanceResult> {
  if (candidate.performance_marker === "SENT") {
    throw new Error(
      "Performance stage already SENT. Clear the marker to re-send.",
    );
  }

  const email = candidateEmail(candidate);
  if (!email) throw new Error("Candidate has no email.");

  // Use only the task template's file. candidate.performance_task_link is a
  // legacy admin-level override unrelated to the current send.
  const taskFileLink = task?.fileLink || "";

  // Fetch the task file and attach it to the email.
  let attachments: EmailAttachment[] | undefined;
  if (taskFileLink) {
    try {
      const rawName = taskFileLink.split("/").pop() || "task-file";
      const filename = rawName.replace(/^\d+_/, "");
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      let fileBytes: Buffer | null = null;
      if (taskFileLink.startsWith("https://")) {
        const resp = await fetch(taskFileLink);
        if (!resp.ok) throw new Error(`Failed to fetch task file: ${resp.status}`);
        fileBytes = Buffer.from(await resp.arrayBuffer());
      } else {
        const { readHiringUpload } = await import("./storage");
        fileBytes = await readHiringUpload(taskFileLink);
      }
      if (fileBytes) {
        attachments = [{
          filename,
          content: fileBytes,
          contentType: contentTypeMap[ext] || "application/octet-stream",
        }];
      }
    } catch (err) {
      throw new Error(
        `Could not load the task file to attach it to the email. Please re-upload the file in Performance Tasks and try again. (${err instanceof Error ? err.message : err})`,
      );
    }
  }

  const token = newUploadToken();
  const uploadLink = buildUploadUrl(token, "performance");
  const deadline = formatDateForEmail(
    addWorkingDays(new Date(), performanceDeadlineDays()),
  );
  const subject = `Next Step: Performance Task – ${candidate.role_applied}`;
  const phones = await getEmailPhones();
  const htmlBody = buildPerformanceTaskEmail(
    candidate.full_name,
    candidate.role_applied,
    uploadLink,
    deadline,
    task?.description ?? undefined,
    Boolean(attachments),
    phones,
  );

  const mail = await sendHiringEmail({ to: email, subject, htmlBody, attachments });
  if (!mail.ok) {
    await logEvent({
      candidateId: candidate.id,
      action: "performance",
      actorId,
      detail: mail.error,
      emailTo: email,
      emailSubject: subject,
      success: false,
    });
    throw new Error(mail.error || "Failed to send performance email");
  }

  const updateSet: Partial<typeof hiringCandidates.$inferInsert> = {
    performanceToken: token,
    performanceMarker: "SENT",
    performanceTaskLink: taskFileLink || null,
    performanceTaskSentAt: new Date(),
    stage: "performance_task_requested",
    updatedAt: new Date(),
  };
  if (task) {
    updateSet.performanceTaskId = task.taskId;
    updateSet.performanceManagerEmail = task.managerEmail;
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set(updateSet)
    .where(eq(hiringCandidates.id, candidate.id))
    .returning();

  if (!updated) throw new Error("Failed to update candidate");

  await logEvent({
    candidateId: candidate.id,
    action: "performance",
    actorId,
    detail: mail.stubbed ? "email stubbed" : "email sent",
    emailTo: email,
    emailSubject: subject,
    success: true,
  });

  return {
    candidate: toCandidate(updated),
    emailStubbed: mail.stubbed,
    action: "performance",
  };
}

async function advanceOnlineInterview(
  candidate: Candidate,
  actorId?: string | null,
  schedule?: { startIso: string; endIso: string; dateLabel: string; timeLabel: string; additionalAttendees?: string[] } | null,
): Promise<AdvanceResult> {
  const email = candidateEmail(candidate);
  if (!email) throw new Error("Candidate has no email.");

  let interviewBlock: { dateLabel: string; timeLabel: string; meetLink: string } | undefined;
  let calendarDetail = "";

  if (schedule) {
    const calResult = await createInterviewEvent({
      candidateName: candidate.full_name,
      candidateEmail: email,
      role: candidate.role_applied,
      startIso: schedule.startIso,
      endIso: schedule.endIso,
      additionalAttendees: schedule.additionalAttendees,
    });

    if (calResult.ok) {
      interviewBlock = {
        dateLabel: schedule.dateLabel,
        timeLabel: schedule.timeLabel,
        meetLink: calResult.meetLink,
      };
      calendarDetail = `calendar:${calResult.eventId} meet:${calResult.meetLink}`;
    } else {
      console.error("[hiring] Google Calendar error:", calResult.error);
      calendarDetail = `calendar_error:${calResult.error}`;
    }
  }

  const fallbackSchedulingInfo =
    process.env.ONLINE_INTERVIEW_SCHEDULING_INFO ||
    "Our HR team will contact you shortly to confirm a date and time for your online interview.";

  const subject = `Online Interview Invitation – ${candidate.role_applied}`;
  const phones = await getEmailPhones();
  const htmlBody = buildOnlineInterviewEmail(
    candidate.full_name,
    candidate.role_applied,
    escapePlain(fallbackSchedulingInfo),
    interviewBlock,
    phones,
  );

  const mail = await sendHiringEmail({ to: email, subject, htmlBody });
  if (!mail.ok) {
    await logEvent({
      candidateId: candidate.id,
      action: "online_interview",
      actorId,
      detail: mail.error,
      emailTo: email,
      emailSubject: subject,
      success: false,
    });
    throw new Error(mail.error || "Failed to send online interview email");
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set({
      stage: "online_interview_requested",
      updatedAt: new Date(),
    })
    .where(eq(hiringCandidates.id, candidate.id))
    .returning();

  if (!updated) throw new Error("Failed to update candidate");

  const detail = [
    mail.stubbed ? "email stubbed" : "email sent",
    calendarDetail,
  ]
    .filter(Boolean)
    .join(" | ");

  await logEvent({
    candidateId: candidate.id,
    action: "online_interview",
    actorId,
    detail,
    emailTo: email,
    emailSubject: subject,
    success: true,
  });

  return {
    candidate: toCandidate(updated),
    emailStubbed: mail.stubbed,
    action: "online_interview",
  };
}

async function advanceInPersonInterview(
  candidate: Candidate,
  actorId?: string | null,
  locationSchedule?: LocationSchedule | null,
): Promise<AdvanceResult> {
  const email = candidateEmail(candidate);
  if (!email) throw new Error("Candidate has no email.");

  const fallbackLocationInfo =
    process.env.IN_PERSON_INTERVIEW_INFO ||
    process.env.IN_PERSON_INTERVIEW_LOCATION ||
    "Our HR team will confirm the campus location, date, and time by reply to this email.";

  const subject = `In-Person Interview Invitation – ${candidate.role_applied}`;
  const phones = await getEmailPhones();
  const htmlBody = buildInPersonInterviewEmail(
    candidate.full_name,
    candidate.role_applied,
    fallbackLocationInfo.includes("<")
      ? fallbackLocationInfo
      : escapePlain(fallbackLocationInfo),
    locationSchedule ?? undefined,
    phones,
  );

  const mail = await sendHiringEmail({ to: email, subject, htmlBody });
  if (!mail.ok) {
    await logEvent({
      candidateId: candidate.id,
      action: "in_person",
      actorId,
      detail: mail.error,
      emailTo: email,
      emailSubject: subject,
      success: false,
    });
    throw new Error(mail.error || "Failed to send in-person interview email");
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set({
      stage: "in_person_interview_requested",
      updatedAt: new Date(),
    })
    .where(eq(hiringCandidates.id, candidate.id))
    .returning();

  if (!updated) throw new Error("Failed to update candidate");

  await logEvent({
    candidateId: candidate.id,
    action: "in_person",
    actorId,
    detail: mail.stubbed ? "email stubbed" : "email sent",
    emailTo: email,
    emailSubject: subject,
    success: true,
  });

  return {
    candidate: toCandidate(updated),
    emailStubbed: mail.stubbed,
    action: "in_person",
  };
}

function escapePlain(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function updateCandidate(
  candidateId: string,
  patch: {
    notes?: string | null;
    linkedin?: string | null;
    cvLink?: string | null;
    performanceTaskLink?: string | null;
    cultureVideoFeedback?: string | null;
    clearCultureMarker?: boolean;
    clearPerformanceMarker?: boolean;
  },
  actorId?: string | null,
): Promise<UpdateCandidateResult> {
  const [row] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);
  if (!row) throw new Error("Candidate not found");

  const wasIncomplete = row.stage === "incomplete_application";
  const linkedinTouched = patch.linkedin !== undefined;
  const cvTouched = patch.cvLink !== undefined;

  const updates: Partial<typeof hiringCandidates.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.notes !== undefined) {
    const notes = String(patch.notes).trim();
    updates.notes = notes ? encryptString(notes) : null;
  }
  if (patch.linkedin !== undefined) updates.linkedin = patch.linkedin;
  if (patch.cvLink !== undefined) updates.cvLink = patch.cvLink;
  if (patch.performanceTaskLink !== undefined) {
    updates.performanceTaskLink = patch.performanceTaskLink;
  }
  if (patch.cultureVideoFeedback !== undefined) {
    const feedback = String(patch.cultureVideoFeedback).trim();
    updates.cultureVideoFeedback = feedback ? encryptString(feedback) : null;
  }
  if (patch.clearCultureMarker) updates.cultureMarker = null;
  if (patch.clearPerformanceMarker) updates.performanceMarker = null;

  if (linkedinTouched || cvTouched) {
    const linkedin =
      patch.linkedin !== undefined ? patch.linkedin : row.linkedin;
    const cvLink = patch.cvLink !== undefined ? patch.cvLink : row.cvLink;
    updates.applicationCheck = applicationCheck(linkedin, cvLink);
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set(updates)
    .where(eq(hiringCandidates.id, candidateId))
    .returning();

  if (!updated) throw new Error("Update failed");

  await logEvent({
    candidateId,
    action: "update",
    actorId,
    detail: "Candidate record updated",
    success: true,
  });

  const candidate = toCandidate(updated);

  if (
    wasIncomplete &&
    candidate.application_check === "OK" &&
    (linkedinTouched || cvTouched)
  ) {
    const promoted = await promoteIncompleteAndSendCulture(candidateId, actorId);
    return {
      candidate: promoted.candidate,
      advanced: true,
      emailStubbed: promoted.emailStubbed,
    };
  }

  return { candidate };
}

async function promoteIncompleteAndSendCulture(
  candidateId: string,
  actorId?: string | null,
): Promise<{ candidate: Candidate; emailStubbed: boolean }> {
  const [row] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);
  if (!row) throw new Error("Candidate not found");

  const check = applicationCheck(row.linkedin, row.cvLink);
  if (check !== "OK") {
    throw new Error(`Application still incomplete: ${check}`);
  }

  const token = row.cultureToken || newUploadToken();
  const [promoted] = await db
    .update(hiringCandidates)
    .set({
      stage: "new",
      cultureToken: token,
      updatedAt: new Date(),
    })
    .where(eq(hiringCandidates.id, candidateId))
    .returning();

  if (!promoted) throw new Error("Update failed");

  const result = await advanceCulture(toCandidate(promoted), actorId, {
    force: true,
  });

  await logEvent({
    candidateId,
    action: "complete_application",
    actorId,
    detail: "Application marked complete; culture email sent",
    success: true,
  });

  return {
    candidate: result.candidate,
    emailStubbed: result.emailStubbed,
  };
}

export async function completeIncompleteApplication(
  candidateId: string,
  input: { linkedin?: string; cvLink?: string },
  actorId?: string | null,
): Promise<{ candidate: Candidate; advanced: boolean; emailStubbed?: boolean }> {
  const updateResult = await updateCandidate(
    candidateId,
    {
      linkedin: input.linkedin?.trim() || null,
      cvLink: input.cvLink?.trim() || null,
    },
    actorId,
  );

  if (updateResult.advanced) {
    return {
      candidate: updateResult.candidate,
      advanced: true,
      emailStubbed: updateResult.emailStubbed,
    };
  }

  return {
    candidate: updateResult.candidate,
    advanced: false,
  };
}

export async function setCandidateOutcome(
  candidateId: string,
  outcome: CandidateOutcome,
  actorId?: string | null,
): Promise<OutcomeResult> {
  const [existing] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);
  if (!existing) throw new Error("Candidate not found");

  const prior = toCandidate(existing);
  const stage: CandidateStage = outcome === "hired" ? "hired" : "rejected";

  // Generate IT onboarding token when hiring
  const itToken = outcome === "hired" ? newOnboardingToken() : undefined;
  const itExpiry =
    outcome === "hired"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : undefined;

  const [updated] = await db
    .update(hiringCandidates)
    .set({
      stage,
      updatedAt: new Date(),
      ...(itToken ? { itOnboardingToken: itToken, itOnboardingExpiresAt: itExpiry } : {}),
    })
    .where(eq(hiringCandidates.id, candidateId))
    .returning();

  if (!updated) throw new Error("Candidate not found");

  let staffProvisioned = false;
  if (outcome === "hired") {
    const email = candidateEmail(prior);
    if (email) {
      await upsertStaffByEmail({
        email,
        fullName: prior.full_name,
        jobTitle: prior.role_applied,
        isAdmin: false,
      });
      staffProvisioned = true;
    }
  }

  const email = candidateEmail(prior);
  let emailStubbed: boolean | undefined;

  // Candidate-facing outcome email (hired welcome / rejection).
  // Hired candidates get the classic welcome here; the full welcome-with-
  // credentials flow still runs later via sendCandidateWelcomeEmail after IT.
  if (email) {
    const subject =
      outcome === "hired"
        ? `Welcome to Silverleaf Academy – ${prior.role_applied}`
        : `Update on your application – ${prior.role_applied}`;
    const htmlBody =
      outcome === "hired"
        ? buildHiredEmail(prior.full_name, prior.role_applied)
        : buildRejectedEmail(prior.full_name, prior.role_applied);

    const mail = await sendHiringEmail({ to: email, subject, htmlBody });
    emailStubbed = mail.stubbed;
    await logEvent({
      candidateId,
      action: outcome,
      actorId,
      detail: mail.ok
        ? mail.stubbed
          ? "outcome email stubbed"
          : "outcome email sent"
        : mail.error || "outcome email failed",
      emailTo: email,
      emailSubject: subject,
      success: mail.ok,
    });
  } else {
    await logEvent({
      candidateId,
      action: outcome,
      actorId,
      detail: `Marked as ${outcome}`,
      success: true,
    });
  }

  // Send IT notification email when hired (onboarding token for account setup).
  if (outcome === "hired" && itToken) {
    const itEmail =
      (await getSetting("it_email")) ||
      process.env.IT_EMAIL ||
      "it@silverleaf.co.tz";
    const formLink = buildOnboardingUrl(itToken);
    const htmlBody = buildItOnboardingRequestEmail(
      updated.fullName,
      updated.roleApplied,
      formLink,
    );
    await sendHiringEmail({
      to: itEmail,
      subject: `ACTION NEEDED: Create email account for new hire — ${updated.fullName}`,
      htmlBody,
    });
  }

  return {
    candidate: toCandidate(updated),
    emailStubbed,
    staffProvisioned,
  };
}

export type RestartStage =
  | "new"
  | "culture_video_submitted"
  | "performance_task_submitted"
  | "online_interview_requested";

export const RESTART_STAGE_LABELS: Record<RestartStage, string> = {
  new: "Fresh start — back to New",
  culture_video_submitted: "After culture video — ready for performance task",
  performance_task_submitted: "After performance task — ready for interview",
  online_interview_requested: "After online interview — ready for in-person",
};

export async function restartCandidate(
  candidateId: string,
  stage: RestartStage,
  actorId?: string | null,
): Promise<Candidate> {
  const [existing] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);
  if (!existing) throw new Error("Candidate not found");
  if (existing.stage !== "rejected") {
    throw new Error("Only rejected candidates can be restarted.");
  }

  const clearSet: Partial<typeof hiringCandidates.$inferInsert> = {
    stage,
    updatedAt: new Date(),
  };

  // Clear markers/tokens for stages that haven't been reached yet
  if (stage === "new") {
    clearSet.cultureMarker = null;
    clearSet.cultureToken = null;
    clearSet.cultureVideoLink = null;
    clearSet.cultureVideoFeedback = null;
    clearSet.performanceMarker = null;
    clearSet.performanceToken = null;
    clearSet.performanceTaskSubmitted = null;
    clearSet.performanceTaskSentAt = null;
  } else if (stage === "culture_video_submitted") {
    clearSet.performanceMarker = null;
    clearSet.performanceToken = null;
    clearSet.performanceTaskSubmitted = null;
    clearSet.performanceTaskSentAt = null;
  } else if (stage === "performance_task_submitted") {
    // Interview hasn't happened — no extra clearing needed
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set(clearSet)
    .where(eq(hiringCandidates.id, candidateId))
    .returning();
  if (!updated) throw new Error("Update failed");

  await logEvent({
    candidateId,
    action: "update",
    actorId,
    detail: `Journey restarted from stage: ${stage}`,
    success: true,
  });

  return toCandidate(updated);
}

/** Called by IT via the public onboarding form to store the new work email. */
export async function submitItOnboarding(
  token: string,
  workEmail: string,
  tempPassword: string,
): Promise<{ candidateName: string; role: string }> {
  const now = new Date();
  const [candidate] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.itOnboardingToken, token))
    .limit(1);

  if (!candidate) throw new Error("Invalid or expired link.");
  if (candidate.itOnboardingExpiresAt && candidate.itOnboardingExpiresAt < now)
    throw new Error("This link has expired. Please ask HR to resend it.");
  if (candidate.itSubmittedAt)
    throw new Error("This account has already been set up.");

  await db
    .update(hiringCandidates)
    .set({
      workEmail,
      itSubmittedAt: now,
      itOnboardingToken: null,
      itOnboardingExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(hiringCandidates.id, candidate.id));

  await logEvent({
    candidateId: candidate.id,
    action: "it_onboarding_submitted",
    detail: `Work email set: ${workEmail}`,
    success: true,
  });

  // Notify HR with the credentials
  const hrEmail =
    (await getSetting("hr_email")) ||
    process.env.GOOGLE_HR_EMAIL ||
    "jobs@silverleaf.co.tz";
  const htmlBody = buildItSubmissionNotificationEmail(
    candidate.fullName,
    candidate.roleApplied,
    workEmail,
    tempPassword,
  );
  await sendHiringEmail({
    to: hrEmail,
    subject: `New employee account created — ${candidate.fullName}`,
    htmlBody,
  });

  return { candidateName: candidate.fullName, role: candidate.roleApplied };
}

/** Validates an IT onboarding token and returns basic candidate info (no secret data). */
export async function validateOnboardingToken(
  token: string,
): Promise<{ candidateName: string; role: string } | null> {
  const now = new Date();
  const [candidate] = await db
    .select({
      fullName: hiringCandidates.fullName,
      roleApplied: hiringCandidates.roleApplied,
      itOnboardingExpiresAt: hiringCandidates.itOnboardingExpiresAt,
      itSubmittedAt: hiringCandidates.itSubmittedAt,
    })
    .from(hiringCandidates)
    .where(eq(hiringCandidates.itOnboardingToken, token))
    .limit(1);

  if (!candidate) return null;
  if (candidate.itOnboardingExpiresAt && candidate.itOnboardingExpiresAt < now)
    return null;
  if (candidate.itSubmittedAt) return null;

  return { candidateName: candidate.fullName, role: candidate.roleApplied };
}

/** HR sends the welcome email to the hired candidate. */
export async function sendCandidateWelcomeEmail(
  candidateId: string,
  startInfo: string,
  actorId?: string | null,
  contractAttachment?: EmailAttachment,
): Promise<Candidate> {
  const [candidate] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);

  if (!candidate) throw new Error("Candidate not found");
  if (!candidate.workEmail)
    throw new Error("Work email not set. Wait for IT to complete account setup.");

  const email = candidate.preferredEmail || candidate.email;
  const phones = await getEmailPhones();
  const htmlBody = buildWelcomeEmail(
    candidate.fullName,
    candidate.roleApplied,
    candidate.workEmail,
    startInfo || undefined,
    phones,
    Boolean(contractAttachment),
  );

  await sendHiringEmail({
    to: email,
    subject: `Welcome to Silverleaf Academy — ${candidate.fullName}`,
    htmlBody,
    attachments: contractAttachment ? [contractAttachment] : undefined,
  });

  const now = new Date();
  const [updated] = await db
    .update(hiringCandidates)
    .set({ welcomeEmailSentAt: now, updatedAt: now })
    .where(eq(hiringCandidates.id, candidateId))
    .returning();

  await logEvent({
    candidateId,
    action: "welcome_email_sent",
    actorId,
    emailTo: email,
    emailSubject: `Welcome to Silverleaf Academy — ${candidate.fullName}`,
    detail: `Work email: ${candidate.workEmail}`,
    success: true,
  });

  return toCandidate(updated!);
}

/** HR resends the IT onboarding email (generates a new token). */
export async function resendItOnboardingEmail(
  candidateId: string,
): Promise<void> {
  const [candidate] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, candidateId))
    .limit(1);

  if (!candidate) throw new Error("Candidate not found");
  if (candidate.itSubmittedAt)
    throw new Error("IT has already submitted the account details.");

  const token = newOnboardingToken();
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db
    .update(hiringCandidates)
    .set({ itOnboardingToken: token, itOnboardingExpiresAt: expiry, updatedAt: new Date() })
    .where(eq(hiringCandidates.id, candidateId));

  const itEmail =
    (await getSetting("it_email")) ||
    process.env.IT_EMAIL ||
    "it@silverleaf.co.tz";
  const formLink = buildOnboardingUrl(token);
  const htmlBody = buildItOnboardingRequestEmail(
    candidate.fullName,
    candidate.roleApplied,
    formLink,
  );
  await sendHiringEmail({
    to: itEmail,
    subject: `[REMINDER] Create email account for new hire — ${candidate.fullName}`,
    htmlBody,
  });
}

export async function recordUpload(params: {
  token: string;
  stage: "culture" | "performance";
  publicUrl: string;
}) {
  const tokenCol =
    params.stage === "culture"
      ? hiringCandidates.cultureToken
      : hiringCandidates.performanceToken;

  const [row] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(tokenCol, params.token))
    .limit(1);

  if (!row) throw new Error("Invalid or expired upload link.");

  if (params.stage === "culture") {
    const [updated] = await db
      .update(hiringCandidates)
      .set({
        cultureVideoLink: params.publicUrl,
        stage: "culture_video_submitted",
        updatedAt: new Date(),
      })
      .where(eq(hiringCandidates.id, row.id))
      .returning();
    if (!updated) throw new Error("Update failed");
    return toCandidate(updated);
  }

  const [updated] = await db
    .update(hiringCandidates)
    .set({
      performanceTaskSubmitted: params.publicUrl,
      stage: "performance_task_submitted",
      updatedAt: new Date(),
    })
    .where(eq(hiringCandidates.id, row.id))
    .returning();
  if (!updated) throw new Error("Update failed");
  return toCandidate(updated);
}

export async function resolveUploadToken(
  token: string,
  stage: "culture" | "performance",
) {
  const tokenCol =
    stage === "culture"
      ? hiringCandidates.cultureToken
      : hiringCandidates.performanceToken;

  const [row] = await db
    .select({
      id: hiringCandidates.id,
      fullName: hiringCandidates.fullName,
      roleApplied: hiringCandidates.roleApplied,
      stage: hiringCandidates.stage,
      performanceManagerEmail: hiringCandidates.performanceManagerEmail,
    })
    .from(hiringCandidates)
    .where(eq(tokenCol, token))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    full_name: row.fullName,
    role_applied: row.roleApplied,
    stage: row.stage,
    performance_manager_email: row.performanceManagerEmail,
  };
}

export async function listAllCandidates(): Promise<Candidate[]> {
  const rows = await db
    .select()
    .from(hiringCandidates)
    .orderBy(desc(hiringCandidates.createdAt));
  return rows.map(toClientCandidate);
}

export async function listCandidatesFiltered(filters?: {
  q?: string;
  stage?: string;
}): Promise<Candidate[]> {
  const all = await listAllCandidates();
  let rows = all;

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.preferred_email || "").toLowerCase().includes(q) ||
        c.role_applied.toLowerCase().includes(q),
    );
  }

  const stage = filters?.stage?.trim();
  if (stage && stage !== "all") {
    rows = rows.filter((c) => c.stage === stage);
  }

  return rows;
}

export async function importCandidatesFromCsv(
  csvText: string,
): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const MAX_ROWS = 500;
  const table = parseCsv(csvText);
  if (table.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }
  if (table.length - 1 > MAX_ROWS) {
    throw new Error(`CSV cannot contain more than ${MAX_ROWS} data rows.`);
  }

  const headers = (table[0] ?? []).map((h) => h.trim());

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (!row || row.every((cell) => !cell.trim())) {
      skipped++;
      continue;
    }

    const record: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      record[header] = row[c] ?? "";
    }

    const mapped = mapApplicationPayload(record);
    const missing = missingApplicationRequirements(mapped);
    if (missing.length) {
      errors.push(
        `Row ${i + 1}: missing ${missing.join(" and ")} (Google Form / CSV).`,
      );
      continue;
    }

    try {
      const result = await ingestApplication({
        fullName: mapped.fullName!,
        email: mapped.email!,
        preferredEmail: mapped.preferredEmail,
        linkedin: mapped.linkedin,
        cvLink: mapped.cvLink,
        roleApplied: mapped.roleApplied || "General",
        notes: mapped.notes || `Source: CSV import (row ${i + 1})`,
      });
      if (result.duplicate) skipped++;
      else imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Row ${i + 1}: ${message}`);
    }
  }

  return { imported, skipped, errors };
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const [row] = await db
    .select()
    .from(hiringCandidates)
    .where(eq(hiringCandidates.id, id))
    .limit(1);
  return row ? toClientCandidate(row) : null;
}

export async function listPipelineEvents(candidateId: string) {
  return db
    .select()
    .from(hiringPipelineEvents)
    .where(eq(hiringPipelineEvents.candidateId, candidateId))
    .orderBy(desc(hiringPipelineEvents.createdAt))
    .limit(20);
}
