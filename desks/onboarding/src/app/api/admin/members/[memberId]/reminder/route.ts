import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { sendHiringEmail } from "@/lib/hiring/mail";
import { buildMemberReminderEmail } from "@/lib/member-emails";

export const dynamic = "force-dynamic";

/** POST /api/admin/members/[memberId]/reminder — send a manual reminder email. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await params;

  const [member] = await db
    .select({ id: staff.id, email: staff.email, fullName: staff.fullName })
    .from(staff)
    .where(eq(staff.id, memberId));

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const name = member.fullName?.trim() || "there";
  const result = await sendHiringEmail({
    to: member.email,
    subject: "Action required: please continue your onboarding",
    htmlBody: buildMemberReminderEmail(name),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stubbed: result.stubbed });
}
