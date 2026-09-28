import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEdAdminStaffByEmail } from "@/lib/auth/ed-admin";
import { openStaffSession } from "@/lib/auth/staff-user";
import { db } from "@/lib/db";
import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";
import { hashOtpCode } from "@/lib/otp";

const bodySchema = z.object({
  email: z.string().max(254),
  code: z.string().max(12),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const email = normalizeStaffEmail(parsed.data.email);
  const code = parsed.data.code.trim();
  if (!isAllowedStaffEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const now = new Date();
  const otp = await db.emailOtp.findFirst({
    where: {
      email,
      codeHash: hashOtpCode(code, email),
      expiresAt: { gt: now },
      usedAt: null,
    },
  });

  if (!otp) {
    const expired = await db.emailOtp.findFirst({
      where: { email, codeHash: hashOtpCode(code, email), usedAt: null },
    });
    return NextResponse.json(
      { ok: false, error: expired ? "expired" : "invalid" },
      { status: 401 },
    );
  }

  await db.emailOtp.update({ where: { id: otp.id }, data: { usedAt: now } });

  const known = await db.user.findUnique({
    where: { email },
    select: { name: true, jobTitle: true },
  });
  const directory = known?.name ? null : await verifyEdAdminStaffByEmail(email);
  const session = await openStaffSession({
    email,
    name: known?.name ?? (directory?.ok ? directory.fullName : null),
    jobTitle: known?.jobTitle ?? (directory?.ok ? directory.jobTitle : null),
  });
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, isNew: session.isNew });
}
