import "server-only";

import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";

export type OtpEligibility =
  | { ok: true; email: string }
  | { ok: false; error: "invalid-email" | "rate-limited" | "send-failed" };

/**
 * Hub OTP uses a Silverleaf work email only. Ed Admin / Staff ID is not
 * consulted in this phase — that directory check comes later.
 */
export async function assertOtpEligibleEmail(
  email: string,
): Promise<OtpEligibility> {
  const normalized = normalizeStaffEmail(email);
  if (!isAllowedStaffEmail(normalized)) {
    return { ok: false, error: "invalid-email" };
  }
  return { ok: true, email: normalized };
}
