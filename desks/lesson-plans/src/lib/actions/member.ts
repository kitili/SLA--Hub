"use server";

/**
 * Member server actions — sign-in / sign-out entry points for the teacher
 * experience. Matches onboarding hub: ed-admin Staff ID for staff, admin
 * password for HR_ADMIN_EMAILS addresses.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth";
import { getConfiguredAdminPassword } from "@/lib/auth/admin-passwords";
import {
  verifyEdAdminStaff,
  verifyEdAdminStaffByEmail,
} from "@/lib/auth/ed-admin";
import type { ActionResult } from "@/lib/contracts";
import { staffRepo } from "@/lib/db/repositories";
import { normalizeStaffEmail } from "@/lib/email";
import {
  allowLocalAdminDirectoryFallback,
  env,
  isHrAdminEmail,
} from "@/lib/env";
import { securityLog } from "@/lib/security/log";
import { takeToken } from "@/lib/security/rate-limit";
import { secretsEqual } from "@/lib/security/secrets";

const signInSchema = z.object({
  email: z.string().max(254),
  staffId: z.string().max(64).optional(),
  adminPassword: z.string().max(128).optional(),
});

export type SignInResult = ActionResult<
  | "not-registered"
  | "inactive"
  | "invalid-input"
  | "admin-password-required"
  | "admin-password-invalid"
  | "directory-unavailable"
  | "failed"
>;

function isDemoAuthAllowed(): boolean {
  return env.NODE_ENV !== "production" || env.ALLOW_DEMO_AUTH;
}

type AdminSignInVerification =
  | Awaited<ReturnType<typeof verifyEdAdminStaffByEmail>>
  | {
      ok: false;
      reason: "admin-password-required" | "admin-password-invalid";
    };

async function verifyAdminSignIn(
  email: string,
  adminPassword: string,
): Promise<AdminSignInVerification> {
  if (!adminPassword) return { ok: false, reason: "admin-password-required" };

  const existingStaff = await staffRepo.findStaffByEmail(email);
  const configured = getConfiguredAdminPassword(email);
  const passwordMatches = configured
    ? secretsEqual(adminPassword, configured)
    : false;

  if (!passwordMatches) {
    return { ok: false, reason: "admin-password-invalid" };
  }

  const verdict = await verifyEdAdminStaffByEmail(email);
  if (verdict.ok) return verdict;

  if (
    allowLocalAdminDirectoryFallback() &&
    (verdict.reason === "not-found" || verdict.reason === "api-error")
  ) {
    return {
      ok: true,
      fullName: existingStaff?.fullName?.trim() || "HR Admin",
      staffId: "local-admin",
      jobTitle: existingStaff?.jobTitle ?? "People Operations",
    };
  }

  return verdict;
}

/**
 * Sign a staff member in — ed-admin email + Staff ID, or admin email +
 * password (same as onboarding hub / workboard).
 */
export async function signInMemberAction(input: {
  email: string;
  staffId?: string;
  adminPassword?: string;
}): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  const email = normalizeStaffEmail(parsed.data.email);
  const staffId = parsed.data.staffId?.trim() ?? "";
  const adminPassword = parsed.data.adminPassword ?? "";
  if (!email) {
    return { ok: false, error: "invalid-input" };
  }
  if (!takeToken(`signin:${email}`, 8, 15 * 60_000)) {
    securityLog("rate.limited", { bucket: "signin" });
    return { ok: false, error: "failed" };
  }

  try {
    if (env.ED_ADMIN_API_TOKEN) {
      const isAdminEmail = isHrAdminEmail(email);
      if (!isAdminEmail && !staffId) {
        return { ok: false, error: "invalid-input" };
      }
      const verdict = isAdminEmail
        ? await verifyAdminSignIn(email, adminPassword)
        : await verifyEdAdminStaff(email, staffId);

      if (!verdict.ok) {
        if (verdict.reason === "admin-password-required") {
          return { ok: false, error: "admin-password-required" };
        }
        if (verdict.reason === "admin-password-invalid") {
          return { ok: false, error: "admin-password-invalid" };
        }
        if (verdict.reason === "inactive") {
          return { ok: false, error: "inactive" };
        }
        if (verdict.reason === "api-error") {
          return { ok: false, error: "directory-unavailable" };
        }
        return { ok: false, error: "not-registered" };
      }

      await signIn(email, verdict.fullName || undefined);
      return { ok: true };
    }

    if (!isDemoAuthAllowed()) {
      console.error(
        "[auth] Sign-in rejected: ED_ADMIN_API_TOKEN is not set in production.",
      );
      return { ok: false, error: "failed" };
    }
    const staff = await staffRepo.findStaffByEmail(email);
    if (!staff) return { ok: false, error: "not-registered" };
    await signIn(email, staff.fullName ?? undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function signOutMemberAction(): Promise<void> {
  await signOut();
  redirect("/sign-in");
}
