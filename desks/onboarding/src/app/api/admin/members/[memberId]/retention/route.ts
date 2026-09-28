import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";
import { getSetting } from "@/lib/app-settings";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { sendHiringEmail } from "@/lib/hiring/mail";
import { buildRetentionCheckInEmail } from "@/lib/member-emails";

export const dynamic = "force-dynamic";

/** POST /api/admin/members/[memberId]/retention — send a retention check-in email. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await params;

  const [member] = await db
    .select({ id: staff.id, email: staff.email, fullName: staff.fullName, startedAt: staff.startedAt })
    .from(staff)
    .where(eq(staff.id, memberId));

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Determine which milestone is closest so we can personalise the email.
  const milestonesSetting = (await getSetting("retention_milestones")) ?? "";
  const milestones = milestonesSetting
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const now = Date.now();
  const daysSince = member.startedAt
    ? Math.floor((now - new Date(member.startedAt).getTime()) / 86_400_000)
    : 0;

  // Pick the closest milestone (within ±7 days) for the email copy.
  let closestMilestone = milestones[0] ?? 21;
  let closestDiff = Infinity;
  for (const m of milestones) {
    const diff = Math.abs(daysSince - m);
    if (diff < closestDiff) { closestDiff = diff; closestMilestone = m; }
  }

  const name = member.fullName?.trim() || "there";
  const result = await sendHiringEmail({
    to: member.email,
    subject: "Checking in — how are you settling in at Silverleaf Academy?",
    htmlBody: buildRetentionCheckInEmail(name, closestMilestone),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stubbed: result.stubbed });
}
