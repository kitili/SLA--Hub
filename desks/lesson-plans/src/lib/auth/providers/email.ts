/**
 * Interim email provider — session stored in a signed httpOnly cookie.
 *
 * This is the default provider (AUTH_PROVIDER=email or unset).  Mark can
 * swap it for `inbound-trust` later without touching any call site.
 *
 * The cookie encode/verify crypto lives in `../session-codec.ts` (pure and
 * unit-tested); this module owns only the `cookies()` plumbing and the
 * provider contract.
 *
 * Cookie name: __sla_session
 */

import "server-only";

import { cookies } from "next/headers";

import type { CurrentUser } from "@/lib/contracts";
import { staffRepo } from "@/lib/db/repositories";
import { env, isHrAdminEmail } from "@/lib/env";
import { normalizeStaffEmail } from "@/lib/email";
import type { AuthProvider } from "../provider";
import {
  decodeSession,
  encodeSession,
  resolveSessionSecret,
  type SessionPayload,
} from "../session-codec";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = "__sla_session";

/** The active signing secret (hard error in prod when SESSION_SECRET is unset). */
function sessionSecret(): string {
  return resolveSessionSecret(env.SESSION_SECRET, env.NODE_ENV);
}

// ---------------------------------------------------------------------------
// Low-level session helpers (exported for action wrappers if needed)
// ---------------------------------------------------------------------------

/**
 * Write a new (or updated) session cookie.
 */
export async function writeSession(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const value = await encodeSession(payload, sessionSecret());
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // 30-day rolling session; reset on every active request if desired.
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Read and verify the session cookie.  Returns null if absent or tampered.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw, sessionSecret());
}

/**
 * Delete the session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export const emailProvider: AuthProvider = {
  async getCurrentUser(): Promise<CurrentUser | null> {
    const session = await getSession();
    if (!session) return null;

    const staffRow = await staffRepo.findStaffById(session.staffId);
    if (!staffRow) return null;

    const isHrAdmin = isHrAdminEmail(staffRow.email);
    const isAdmin = staffRow.isAdmin || (session.adminElevated === true && isHrAdmin);
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

  async signIn(email: string, fullName?: string): Promise<CurrentUser> {
    const normalizedEmail = staffRepo.normalizeEmail(normalizeStaffEmail(email));
    const isAdminByPolicy = isHrAdminEmail(normalizedEmail);

    // Sign-in eligibility (ed-admin directory membership) is enforced upstream
    // in `signInMemberAction`; the provider no longer gates on email domain.

    const staffRow = await staffRepo.upsertStaffByEmail({
      email: normalizedEmail,
      fullName: fullName?.trim() ?? "",
      isAdmin: isAdminByPolicy,
    });

    await writeSession({ staffId: staffRow.id });

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

  async verifyAdminPin(pin: string): Promise<boolean> {
    const session = await getSession();
    if (!session) {
      throw new Error("[auth/email] verifyAdminPin called with no active session.");
    }
    if (!env.ADMIN_PIN) {
      throw new Error(
        "[auth/email] ADMIN_PIN is not configured — admin self-elevation is disabled.",
      );
    }
    if (pin !== env.ADMIN_PIN) {
      return false;
    }
    // Mark this session as admin-elevated.
    await writeSession({ ...session, adminElevated: true });
    return true;
  },
};
