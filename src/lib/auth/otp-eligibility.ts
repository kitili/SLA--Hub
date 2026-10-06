import "server-only";

import { verifyEdAdminStaffByEmail } from "@/lib/auth/ed-admin";
import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";

export type OtpEligibility =
  | { ok: true; email: string }
  | { ok: false; error: "invalid-email" | "rate-limited" | "send-failed" };

/**
 * Leftover OTP path still has to be an active Ed Admin staff email.
 * Hub sign-in itself is email + Staff ID, not a code.
 */
export async function assertOtpEligibleEmail(
  email: string,
): Promise<OtpEligibility> {
  const normalized = normalizeStaffEmail(email);
  if (!isAllowedStaffEmail(normalized)) {
    return { ok: false, error: "invalid-email" };
  }
  const verdict = await verifyEdAdminStaffByEmail(normalized);
  if (!verdict.ok) {
    if (verdict.reason === "api-error") return { ok: false, error: "send-failed" };
    return { ok: false, error: "invalid-email" };
  }
  return { ok: true, email: normalized };
}
