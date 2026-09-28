import "server-only";

import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";
import { verifyEdAdminStaffByEmail } from "@/lib/auth/ed-admin";

export type OtpEligibility =
  | {
      ok: true;
      email: string;
      fullName: string;
      staffId: string;
      jobTitle: string;
    }
  | {
      ok: false;
      error: "invalid-email" | "not-found" | "inactive" | "directory-unavailable";
    };

/**
 * OTP sign-in must use the live ed-admin directory, not the local staff table.
 * Local rows are only created after a first successful sign-in, so looking
 * them up would reject every real staff email on a fresh production database.
 */
export async function assertOtpEligibleEmail(
  email: string,
): Promise<OtpEligibility> {
  const normalized = normalizeStaffEmail(email);
  if (!isAllowedStaffEmail(normalized)) {
    return { ok: false, error: "invalid-email" };
  }

  const verdict = await verifyEdAdminStaffByEmail(normalized);
  if (verdict.ok) {
    return {
      ok: true,
      email: normalized,
      fullName: verdict.fullName,
      staffId: verdict.staffId,
      jobTitle: verdict.jobTitle,
    };
  }
  if (verdict.reason === "api-error") {
    return { ok: false, error: "directory-unavailable" };
  }
  if (verdict.reason === "inactive") {
    return { ok: false, error: "inactive" };
  }
  return { ok: false, error: "not-found" };
}
