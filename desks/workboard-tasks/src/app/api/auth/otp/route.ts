import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSmtpConfigured, sendOtpEmail } from "@/lib/auth/otp-mail";
import { db } from "@/lib/db";
import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 3;

const bodySchema = z.object({ email: z.string().max(254) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const email = normalizeStaffEmail(parsed.data.email);
  if (!isAllowedStaffEmail(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db.emailOtp.count({
    where: { email, createdAt: { gt: windowStart } },
  });
  if (recent >= RATE_LIMIT) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  const code = generateOtpCode();
  await db.emailOtp.create({
    data: {
      email,
      codeHash: hashOtpCode(code, email),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const sent = await sendOtpEmail(email, code);
  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: "send-failed" }, { status: 502 });
  }

  const showCode = !isSmtpConfigured() && process.env.NODE_ENV !== "production";
  return NextResponse.json(showCode ? { ok: true, devCode: code } : { ok: true });
}
