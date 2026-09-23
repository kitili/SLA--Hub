/**
 * Interim email provider — session stored in a signed httpOnly cookie.
 *
 * This is the default provider (AUTH_PROVIDER=email or unset).  Mark can
 * swap it for `inbound-trust` later without touching any call site.
 *
 * Cookie encoding lives in `session-cookie.ts` so Edge middleware can slide
 * or expire the same payload. Lifetime is a 15-minute idle window.
 */

import "server-only";

import { cookies } from "next/headers";

import type { CurrentUser } from "@/lib/contracts";
import { accessRepo, staffRepo } from "@/lib/db/repositories";
import { isHrAdminEmail } from "@/lib/env";
import { normalizeStaffEmail } from "@/lib/email";
import type { AuthProvider } from "../provider";
import {
  buildSessionPayload,
  decodeSession,
  encodeSession,
  expiredSessionCookieOptions,
  getSessionCookieName,
  sessionCookieOptions,
  type SessionPayload,
} from "../session-cookie";

export type { SessionPayload };

export async function writeSession(data: {
  staffId: string;
  isAdmin?: boolean;
}): Promise<void> {
  const cookieStore = await cookies();
  const value = await encodeSession(
    buildSessionPayload(data.staffId, Date.now(), data.isAdmin === true),
  );
  cookieStore.set(getSessionCookieName(), value, sessionCookieOptions());
}

/**
 * Read and verify the session cookie.  Returns null if absent or tampered.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getSessionCookieName())?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

/**
 * Delete the session cookie.
 *
 * Must reuse the same Path/Secure/SameSite as {@link writeSession}. A name-only
 * delete does not clear `__Host-sla_session` in production, so the user would
 * still look signed in after logging out.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), "", expiredSessionCookieOptions());
}

export const emailProvider: AuthProvider = {
  async getCurrentUser(): Promise<CurrentUser | null> {
    const session = await getSession();
    if (!session) return null;

    let staffRow: Awaited<ReturnType<typeof staffRepo.findStaffById>>;
    try {
      staffRow = await staffRepo.findStaffById(session.staffId);
    } catch (error) {
      // Local PGlite can abort when a dev database/session gets stale. Treat it
      // like an expired session so localhost still reaches the sign-in screen.
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth/email] Could not load current user session.", error);
      }
      return null;
    }
    if (!staffRow) return null;

    const isAdmin = staffRow.isAdmin;
    const roles: string[] = isAdmin ? ["admin"] : [];

    return {
      id: staffRow.id,
      email: staffRow.email,
      fullName: staffRow.fullName,
      isAdmin,
      roles,
      campus: staffRow.campus ?? null,
      jobTitle: staffRow.jobTitle ?? null,
    };
  },

  async signIn(
    email: string,
    fullName?: string,
    extras?: { jobTitle?: string; edAdminStaffId?: string },
  ): Promise<CurrentUser> {
    const normalizedEmail = staffRepo.normalizeEmail(normalizeStaffEmail(email));
    const isAdminByPolicy = isHrAdminEmail(normalizedEmail);

    // Sign-in eligibility (ed-admin directory membership) is enforced upstream
    // in `signInMemberAction`; the provider no longer gates on email domain.

    const staffRow = await staffRepo.upsertStaffByEmail({
      email: normalizedEmail,
      fullName: fullName?.trim() ?? "",
      jobTitle: extras?.jobTitle ?? null,
      edAdminStaffId: extras?.edAdminStaffId ?? null,
      isAdmin: isAdminByPolicy,
    });

    await writeSession({ staffId: staffRow.id, isAdmin: staffRow.isAdmin });

    try {
      await accessRepo.recordAccessEvent({
        staffId: staffRow.id,
        email: staffRow.email,
        fullName: staffRow.fullName,
        action: "signed_in",
        path: "/login",
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth/email] Could not record sign-in.", error);
      }
    }

    const roles: string[] = staffRow.isAdmin ? ["admin"] : [];

    return {
      id: staffRow.id,
      email: staffRow.email,
      fullName: staffRow.fullName,
      isAdmin: staffRow.isAdmin,
      roles,
      campus: staffRow.campus ?? null,
      jobTitle: staffRow.jobTitle ?? null,
    };
  },

  async signOut(): Promise<void> {
    await destroySession();
  },
};
