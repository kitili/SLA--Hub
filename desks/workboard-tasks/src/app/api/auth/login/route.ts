import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEdAdminStaff } from "@/lib/auth/ed-admin";
import { openStaffSession } from "@/lib/auth/staff-user";
import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";

const bodySchema = z.object({
  email: z.string().max(254),
  staffId: z.string().max(64),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid-input" }, { status: 400 });
  }

  const email = normalizeStaffEmail(parsed.data.email);
  const staffId = parsed.data.staffId.trim();
  if (!email || !staffId || !isAllowedStaffEmail(email)) {
    return NextResponse.json({ ok: false, error: "invalid-input" }, { status: 400 });
  }

  const verdict = await verifyEdAdminStaff(email, staffId);
  if (!verdict.ok) {
    const error =
      verdict.reason === "inactive"
        ? "inactive"
        : verdict.reason === "api-error"
          ? "directory-unavailable"
          : "not-registered";
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const session = await openStaffSession({
    email,
    name: verdict.fullName,
    jobTitle: verdict.jobTitle,
  });
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: session.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
