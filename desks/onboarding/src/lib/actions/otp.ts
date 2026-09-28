"use server";

import { and, eq, gt, isNull } from "drizzle-orm";

import { signIn } from "@/lib/auth";
import { assertOtpEligibleEmail } from "@/lib/auth/otp-eligibility";
import { sendOtpEmail } from "@/lib/auth/otp-mail";
import { db } from "@/lib/db/client";
import { emailOtps, staff } from "@/lib/db/schema";
import { normalizeStaffEmail } from "@/lib/email";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 3;

export type RequestOtpResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "invalid-email"
        | "not-found"
        | "inactive"
        | "directory-unavailable"
        | "rate-limited"
        | "send-failed";
    };

export type VerifyOtpResult =
  | { ok: true; isNew: boolean }
  | { ok: false; error: "invalid" | "expired" };

export async function requestOtpAction(
  email: string,
): Promise<RequestOtpResult> {
  const eligible = await assertOtpEligibleEmail(email);
  if (!eligible.ok) {
    return eligible;
  }
  const normalized = eligible.email;

  // Rate limit: max 3 OTP requests per email per 5 minutes.
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await db
    .select({ id: emailOtps.id })
    .from(emailOtps)
    .where(
      and(
        eq(emailOtps.email, normalized),
        gt(emailOtps.createdAt, windowStart),
      ),
    );

  if (recent.length >= RATE_LIMIT) {
    return { ok: false, error: "rate-limited" };
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code, normalized);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(emailOtps).values({ email: normalized, codeHash, expiresAt });

  const sent = await sendOtpEmail(normalized, code);
  if (!sent.ok) {
    return { ok: false, error: "send-failed" };
  }

  return { ok: true };
}

export async function verifyOtpAction(
  email: string,
  code: string,
): Promise<VerifyOtpResult> {
  const normalized = normalizeStaffEmail(email);
  const codeHash = hashOtpCode(code.trim(), normalized);
  const now = new Date();

  const [otp] = await db
    .select()
    .from(emailOtps)
    .where(
      and(
        eq(emailOtps.email, normalized),
        eq(emailOtps.codeHash, codeHash),
        gt(emailOtps.expiresAt, now),
        isNull(emailOtps.usedAt),
      ),
    )
    .limit(1);

  if (!otp) {
    return { ok: false, error: "invalid" };
  }

  // Mark consumed — one-time use.
  await db
    .update(emailOtps)
    .set({ usedAt: now })
    .where(eq(emailOtps.id, otp.id));

  const eligible = await assertOtpEligibleEmail(normalized);
  if (eligible.ok) {
    await signIn(eligible.email, eligible.fullName, {
      edAdminStaffId: eligible.staffId,
      jobTitle: eligible.jobTitle,
    });
    // Prompt for name when directory has no usable full name (kiki flow).
    return { ok: true, isNew: !eligible.fullName.trim() };
  }

  // Directory blip after a valid code: keep the local profile if we have one.
  const [member] = await db
    .select({
      fullName: staff.fullName,
      edAdminStaffId: staff.edAdminStaffId,
      jobTitle: staff.jobTitle,
    })
    .from(staff)
    .where(eq(staff.email, normalized))
    .limit(1);

  if (!member || eligible.error !== "directory-unavailable") {
    return { ok: false, error: "invalid" };
  }

  await signIn(normalized, member.fullName ?? "", {
    edAdminStaffId: member.edAdminStaffId ?? undefined,
    jobTitle: member.jobTitle ?? undefined,
  });

  return { ok: true, isNew: !member.fullName?.trim() };
}
