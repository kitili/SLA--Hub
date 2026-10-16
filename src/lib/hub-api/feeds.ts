import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  contentVersions,
  hiringCandidates,
  materials,
  memberProfiles,
  onboardingFeedback,
  sectionItems,
  sections,
  signoffs,
} from "@/lib/db/schema";
import { getMemberMonitorOverview } from "@/lib/db/queries/admin";
import { slaBotRepo } from "@/lib/db/repositories";
import { STAGE_LABELS, type CandidateStage } from "@/lib/hiring/types";

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function stageLabel(stage: string) {
  return STAGE_LABELS[stage as CandidateStage] ?? stage;
}

function materialPath(storageKey: string) {
  return `/api/materials/${storageKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export async function loadJourneyFeed() {
  const [overview, feedbackRows, signoffRows, bioRows] = await Promise.all([
    getMemberMonitorOverview(),
    db.select().from(onboardingFeedback),
    db
      .select({
        memberId: signoffs.memberId,
        signedAt: signoffs.signedAt,
        label: contentVersions.label,
      })
      .from(signoffs)
      .innerJoin(
        contentVersions,
        eq(signoffs.contentVersionId, contentVersions.id),
      )
      .orderBy(desc(signoffs.signedAt)),
    db
      .select({
        memberId: memberProfiles.memberId,
        submittedAt: memberProfiles.submittedAt,
        position: memberProfiles.position,
        workStation: memberProfiles.workStation,
        firstName: memberProfiles.firstName,
        surname: memberProfiles.surname,
      })
      .from(memberProfiles),
  ]);

  const feedbackByMember = new Map(feedbackRows.map((row) => [row.memberId, row]));
  const signoffByMember = new Map<string, { signedAt: Date; label: string }>();
  for (const row of signoffRows) {
    if (!signoffByMember.has(row.memberId)) {
      signoffByMember.set(row.memberId, { signedAt: row.signedAt, label: row.label });
    }
  }
  const bioByMember = new Map(bioRows.map((row) => [row.memberId, row]));

  return overview.members.map((member) => {
    const feedback = feedbackByMember.get(member.id);
    const signOff = signoffByMember.get(member.id);
    const bio = bioByMember.get(member.id);
    return {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      campus: member.campus,
      jobTitle: member.jobTitle,
      startedAt: iso(member.startedAt),
      lastActiveAt: iso(member.lastActiveAt),
      documentsRead: member.documentsRead,
      checkpointsPassed: member.checkpointsPassed,
      completionPct: member.completionPct,
      complete: member.complete,
      bio: bio
        ? {
            submitted: true,
            submittedAt: iso(bio.submittedAt),
            firstName: bio.firstName,
            surname: bio.surname,
            position: bio.position,
            workStation: bio.workStation,
          }
        : { submitted: false },
      signOff: signOff
        ? { signedAt: iso(signOff.signedAt), contentVersion: signOff.label }
        : null,
      feedback: feedback
        ? {
            expectations: feedback.expectations,
            unclear: feedback.unclear,
            improvements: feedback.improvements,
            submittedAt: iso(feedback.submittedAt),
          }
        : null,
    };
  });
}

export async function loadHiringFeed() {
  const rows = await db
    .select({
      id: hiringCandidates.id,
      fullName: hiringCandidates.fullName,
      email: hiringCandidates.email,
      preferredEmail: hiringCandidates.preferredEmail,
      roleApplied: hiringCandidates.roleApplied,
      stage: hiringCandidates.stage,
      workEmail: hiringCandidates.workEmail,
      welcomeEmailSentAt: hiringCandidates.welcomeEmailSentAt,
      updatedAt: hiringCandidates.updatedAt,
    })
    .from(hiringCandidates)
    .orderBy(desc(hiringCandidates.updatedAt));

  return {
    stages: Object.entries(STAGE_LABELS).map(([id, label]) => ({ id, label })),
    data: rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      preferredEmail: row.preferredEmail,
      roleApplied: row.roleApplied,
      stage: row.stage,
      stageLabel: stageLabel(row.stage),
      workEmail: row.workEmail,
      welcomeEmailSentAt: iso(row.welcomeEmailSentAt),
      updatedAt: iso(row.updatedAt),
    })),
  };
}

export async function loadTicketFeed() {
  const alerts = await slaBotRepo.listOpenAlerts(200);
  return alerts.map((alert) => ({
    id: alert.id,
    kind: alert.kind,
    severity: alert.severity,
    summary: alert.summary,
    detail: alert.detail,
    memberEmail: alert.memberEmail,
    memberName: alert.memberName,
    emailSent: alert.emailSent,
    createdAt: iso(alert.createdAt),
  }));
}

export async function loadCatalogFeed() {
  const [sectionRows, itemRows, materialRows] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.order)),
    db.select().from(sectionItems).orderBy(asc(sectionItems.order)),
    db.select().from(materials),
  ]);

  const itemsBySection = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsBySection.get(item.sectionId) ?? [];
    list.push(item);
    itemsBySection.set(item.sectionId, list);
  }

  const pdfs = [];
  const videos = [];
  for (const material of materialRows) {
    const youtube =
      material.contentType === "video/youtube" ||
      material.url.includes("youtube.com") ||
      material.storageKey.includes("youtube.com");
    const record = {
      id: material.id,
      itemId: material.sectionItemId ?? material.ownerItemId,
      filename: material.filename,
      contentType: material.contentType,
      url: youtube ? material.url || material.storageKey : materialPath(material.storageKey),
    };
    if (youtube || material.contentType.startsWith("video/")) videos.push(record);
    else pdfs.push(record);
  }

  return {
    sections: sectionRows.map((section) => ({
      id: section.id,
      number: section.number,
      title: section.title_en,
      published: section.isPublished,
      items: (itemsBySection.get(section.id) ?? []).map((item) => ({
        id: item.id,
        order: item.order,
        type: item.type,
        title: item.title_en,
      })),
    })),
    pdfs,
    videos,
  };
}
