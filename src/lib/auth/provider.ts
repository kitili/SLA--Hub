/**
 * AuthProvider contract — the interface every identity backend must satisfy.
 *
 * The identity interface (`identity.ts`) delegates to exactly one provider,
 * selected by AUTH_PROVIDER in the environment.  Swapping the provider at the
 * env level is the ONLY change required — all call sites remain identical.
 */

import type { CurrentUser } from "@/lib/contracts";

/**
 * Resolved identity for the current request.
 *
 * `null` means "no authenticated session".  The identity interface converts
 * this into redirects/throws as appropriate for each helper.
 */
export type IdentityResult = CurrentUser | null;

/**
 * A provider must implement these async functions.  They are all server-side
 * and may read cookies / headers / signed tokens freely.
 */
export interface AuthProvider {
  /**
   * Return the CurrentUser for the active session, or null when unauthenticated.
   * Called on every request that needs to know who is acting.
   */
  getCurrentUser(): Promise<IdentityResult>;

  /**
   * Establish a session for `email`.
   * Upserts the staff row, honours HR-admin policy, sets the session cookie,
   * and returns the resulting CurrentUser.
   */
  signIn(
    email: string,
    fullName?: string,
    extras?: { jobTitle?: string; edAdminStaffId?: string },
  ): Promise<CurrentUser>;

  /**
   * Destroy the active session.  Safe to call when no session exists.
   */
  signOut(): Promise<void>;
}
