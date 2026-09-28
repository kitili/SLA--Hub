import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";
import { riskLevel } from "@/lib/at-risk";
import { getSetting } from "@/lib/app-settings";
import { sendHiringEmail } from "@/lib/hiring/mail";
import {
  buildMemberReminderEmail,
  buildBioFormReminderEmail,
  buildHrOffTrackReportEmail,
  buildHrMilestoneReportEmail,
  buildRetentionCheckInEmail,
  type OffTrackMemberRow,
  type MilestoneRow,
} from "@/lib/member-emails";
import { getMemberMonitorOverview } from "@/lib/db/queries/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/offtrack-reminder
 *
 * Vercel Cron — runs at 07:00 EAT (04:00 UTC) every day.
 * Protected by the CRON_SECRET env var that Vercel injects automatically.
 *
 * For every orange/red member: sends a personal reminder to log in.
 * For every completed member with no bio form: sends a bio-specific reminder.
 * HR receives a single daily summary covering both groups.
 */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (prevents anyone from triggering this manually).
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch all members with their progress data.
  // totalCheckpoints is used to compute checkpoint-only risk (see below).
  const { members, totalCheckpoints } = await getMemberMonitorOverview();

  // Parse HR-configured retention milestones (e.g. "21,42" days).
  const milestonesSetting = (await getSetting("retention_milestones")) ?? "";
  const retentionMilestones = milestonesSetting
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const offTrack: OffTrackMemberRow[] = [];
  type BioMissingRow = { fullName: string; email: string; campus: string | null };
  const missingBio: BioMissingRow[] = [];
  const milestoneHits: MilestoneRow[] = [];

  for (const m of members) {
    const name = m.fullName || m.email;

    // Check if member hits a retention milestone today (all members, including complete).
    if (retentionMilestones.length > 0 && m.startedAt) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(m.startedAt).getTime()) / 86_400_000,
      );
      for (const milestone of retentionMilestones) {
        if (Math.abs(daysSince - milestone) <= 1) {
          milestoneHits.push({
            fullName: name,
            email: m.email,
            campus: m.campus,
            milestoneDays: milestone,
          });
          break;
        }
      }
    }

    if (m.complete) {
      // Finished onboarding but never filled bio form → bio-specific nudge.
      if (!m.hasBio) {
        missingBio.push({ fullName: name, email: m.email, campus: m.campus });
      }
      continue;
    }

    const checkpointPct =
      totalCheckpoints > 0
        ? Math.round((m.checkpointsPassed / totalCheckpoints) * 100)
        : 0;

    const risk = riskLevel({
      startedAt: m.startedAt,
      completionPct: checkpointPct,
      lastActiveAt: m.lastActiveAt,
      now,
    });

    if (risk === "green") continue;

    offTrack.push({
      fullName: name,
      email: m.email,
      campus: m.campus,
      completionPct: m.completionPct,
      risk,
      lastActiveAt: m.lastActiveAt ? m.lastActiveAt.toString() : null,
    });
  }

  if (offTrack.length === 0 && missingBio.length === 0 && milestoneHits.length === 0) {
    console.info("[cron/offtrack-reminder] Nothing to send today.");
    return NextResponse.json({ ok: true, sentToMembers: 0, sentBioReminders: 0, hrNotified: false, milestoneHits: 0 });
  }

  const hrEmail =
    (await getSetting("hr_email")) ||
    process.env.GOOGLE_HR_EMAIL ||
    "jobs@silverleaf.co.tz";
  // Always notify both HR inboxes.
  const hrRecipients = Array.from(
    new Set([hrEmail, "hr@silverleaf.co.tz", "jobs@silverleaf.co.tz"]),
  );

  const sentDate = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 1. Send onboarding reminders to off-track members.
  const offTrackResults = await Promise.allSettled(
    offTrack.map((m) =>
      sendHiringEmail({
        to: m.email,
        subject: "Action required: please continue your onboarding",
        htmlBody: buildMemberReminderEmail(m.fullName),
      }),
    ),
  );
  const sentToMembers = offTrackResults.filter(
    (r) => r.status === "fulfilled" && r.value.ok,
  ).length;

  // 2. Send bio form reminders to completed-but-no-bio members.
  const bioResults = await Promise.allSettled(
    missingBio.map((m) =>
      sendHiringEmail({
        to: m.email,
        subject: "Action required: please fill in your bio data form",
        htmlBody: buildBioFormReminderEmail(m.fullName),
      }),
    ),
  );
  const sentBioReminders = bioResults.filter(
    (r) => r.status === "fulfilled" && r.value.ok,
  ).length;

  // 3. Send daily HR report covering off-track + missing bio members.
  let hrNotified = false;
  if (offTrack.length > 0 || missingBio.length > 0) {
    const hrReport = buildHrOffTrackReportEmail(offTrack, sentDate, missingBio);
    const hrResults = await Promise.allSettled(
      hrRecipients.map((to) =>
        sendHiringEmail({
          to,
          subject: `[Daily] ${offTrack.length + missingBio.length} member${offTrack.length + missingBio.length !== 1 ? "s" : ""} need attention — ${sentDate}`,
          htmlBody: hrReport,
        }),
      ),
    );
    hrNotified = hrResults.some((r) => r.status === "fulfilled" && r.value.ok);
  }

  // 4. Auto-send retention check-in email to each member who hit a milestone,
  //    then notify all HR inboxes with the milestone report.
  let milestoneEmailSent = false;
  let milestoneCheckInsSent = 0;
  if (milestoneHits.length > 0) {
    const checkInResults = await Promise.allSettled(
      milestoneHits.map((m) =>
        sendHiringEmail({
          to: m.email,
          subject: `Your ${Math.round(m.milestoneDays / 7)}-week check-in`,
          htmlBody: buildRetentionCheckInEmail(m.fullName, m.milestoneDays),
        }),
      ),
    );
    milestoneCheckInsSent = checkInResults.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;

    const milestoneReport = buildHrMilestoneReportEmail(milestoneHits, sentDate);
    const milestoneHrResults = await Promise.allSettled(
      hrRecipients.map((to) =>
        sendHiringEmail({
          to,
          subject: `[Retention] ${milestoneHits.length} staff member${milestoneHits.length !== 1 ? "s" : ""} reached a milestone — ${sentDate}`,
          htmlBody: milestoneReport,
        }),
      ),
    );
    milestoneEmailSent = milestoneHrResults.some(
      (r) => r.status === "fulfilled" && r.value.ok,
    );
  }

  console.info("[cron/offtrack-reminder]", {
    offTrackCount: offTrack.length,
    missingBioCount: missingBio.length,
    milestoneHits: milestoneHits.length,
    sentToMembers,
    sentBioReminders,
    milestoneCheckInsSent,
    hrNotified,
    milestoneEmailSent,
  });

  return NextResponse.json({
    ok: true,
    offTrackCount: offTrack.length,
    missingBioCount: missingBio.length,
    milestoneHits: milestoneHits.length,
    sentToMembers,
    sentBioReminders,
    milestoneCheckInsSent,
    hrNotified,
    milestoneEmailSent,
  });
}
