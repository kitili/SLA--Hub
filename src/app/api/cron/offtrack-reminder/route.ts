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
  type OffTrackMemberRow,
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

  const offTrack: OffTrackMemberRow[] = [];
  type BioMissingRow = { fullName: string; email: string; campus: string | null };
  const missingBio: BioMissingRow[] = [];

  for (const m of members) {
    const name = m.fullName || m.email;

    if (m.complete) {
      // Finished onboarding but never filled bio form → bio-specific nudge.
      if (!m.hasBio) {
        missingBio.push({ fullName: name, email: m.email, campus: m.campus });
      }
      continue;
    }

    // Risk is calculated from checkpoint completions only — not document reads.
    // Using the combined completionPct lets members click through items to
    // inflate their score back to "green" without actually passing any quizzes.
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

  if (offTrack.length === 0 && missingBio.length === 0) {
    console.info("[cron/offtrack-reminder] Nothing to send today.");
    return NextResponse.json({ ok: true, sentToMembers: 0, sentBioReminders: 0, hrNotified: false });
  }

  const hrEmail =
    (await getSetting("hr_email")) ||
    process.env.GOOGLE_HR_EMAIL ||
    "jobs@silverleaf.co.tz";

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

  // 3. Send daily HR report covering both groups.
  const hrReport = buildHrOffTrackReportEmail(offTrack, sentDate, missingBio);
  const hrResult = await sendHiringEmail({
    to: hrEmail,
    subject: `[Daily] ${offTrack.length + missingBio.length} member${offTrack.length + missingBio.length !== 1 ? "s" : ""} need attention — ${sentDate}`,
    htmlBody: hrReport,
  });

  console.info("[cron/offtrack-reminder]", {
    offTrackCount: offTrack.length,
    missingBioCount: missingBio.length,
    sentToMembers,
    sentBioReminders,
    hrNotified: hrResult.ok,
  });

  return NextResponse.json({
    ok: true,
    offTrackCount: offTrack.length,
    missingBioCount: missingBio.length,
    sentToMembers,
    sentBioReminders,
    hrNotified: hrResult.ok,
  });
}
