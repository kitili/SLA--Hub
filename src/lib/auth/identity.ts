/**
 * Identity interface — the SINGLE surface every route, layout, and server
 * action calls to resolve the current user.
 *
 * Nothing outside this module reads cookies, headers, or session state
 * directly.  Provider selection is controlled by AUTH_PROVIDER (default:
 * "email").  Swapping providers requires ZERO changes at call sites.
 *
 * Supported providers:
 *   email          — interim email self-registration (default)
 *   inbound-trust  — signed JWT / trusted header from school admin platform
 */

import "server-only";

import { redirect } from "next/navigation";

import type { CurrentUser } from "@/lib/contracts";
import type { AuthProvider } from "./provider";
import { emailProvider } from "./providers/email";
import { inboundTrustProvider } from "./providers/inbound-trust";

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

// Static imports (NOT dynamic `require`): under the Next.js RSC bundler a
// CommonJS `require()` of these ESM modules resolves to `undefined`, which made
// `getProvider()` throw at runtime. Both providers are tiny and the inbound-
// trust stub does no work at import time (its methods throw only when called),
// so importing both is harmless.
function resolveProvider(): AuthProvider {
  const providerName = process.env["AUTH_PROVIDER"] ?? "email";

  switch (providerName) {
    case "email":
      return emailProvider;
    case "inbound-trust":
      return inboundTrustProvider;
    default:
      throw new Error(
        `[auth/identity] Unknown AUTH_PROVIDER="${providerName}". ` +
          `Valid values: "email", "inbound-trust".`,
      );
  }
}

/** Memoised per-process provider instance (avoids repeated requires). */
let _provider: AuthProvider | undefined;

function getProvider(): AuthProvider {
  if (!_provider) _provider = resolveProvider();
  return _provider;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the CurrentUser for the active session, or `null` when not
 * authenticated.  Safe to call from any Server Component or Route Handler.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getProvider().getCurrentUser();
}

/**
 * Return the CurrentUser, or redirect to the sign-in page.
 *
 * Use in layouts/pages that require authentication.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Return the CurrentUser, or redirect if not authenticated / not an admin.
 *
 * Use in layouts/pages that require admin access.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    redirect("/unauthorized");
  }
  return user;
}

/**
 * Return the CurrentUser, or redirect if not authenticated / missing the role.
 *
 * @param role  A fine-grained permission tag (e.g. "content-editor")
 */
export async function requireRole(role: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.includes(role)) {
    redirect("/unauthorized");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Provider pass-through helpers (for server actions)
// ---------------------------------------------------------------------------

/**
 * Establish a session.  Delegates to the active provider's `signIn`.
 * Called from the member server actions (`@/lib/actions/member`), which gate on
 * the ed-admin directory — not directly from route handlers.
 */
export async function signIn(
  email: string,
  fullName?: string,
  extras?: { jobTitle?: string; edAdminStaffId?: string },
): Promise<CurrentUser> {
  return getProvider().signIn(email, fullName, extras);
}

/**
 * Destroy the active session.  Safe to call when unauthenticated.
 */
export async function signOut(): Promise<void> {
  return getProvider().signOut();
}
