/**
 * Inbound-trust provider — reads a signed JWT or trusted header from the
 * school admin's identity platform and maps claims → CurrentUser.
 *
 * STATUS: stub — not yet configured.
 *
 * When AUTH_PROVIDER=inbound-trust is set, this provider is active.  Every
 * function throws until the signing key and claim mapping are wired in by
 * the platform engineer (see docs/identity.md § Inbound-Trust Provider).
 *
 * No call site needs to change when this provider replaces the email provider:
 * all routes/layouts/actions go through `identity.ts` and the provider
 * selection is purely a runtime environment concern.
 */

import "server-only";

import type { CurrentUser } from "@/lib/contracts";
import type { AuthProvider } from "../provider";

// ---------------------------------------------------------------------------
// Claim mapping (documented in docs/identity.md § Claim Mapping)
// ---------------------------------------------------------------------------
//
// Expected JWT / header claims → CurrentUser field:
//
//   sub            → id
//   email          → email
//   name           → fullName
//   is_admin       → isAdmin      (boolean, default: false)
//   roles          → roles        (string[], default: [])
//   campus         → campus       (string | null)
//   job_title      → jobTitle     (string | null)
//
// The JWT must be signed with RS256 or HS256 and the verifying key must be
// available in INBOUND_TRUST_JWKS_URL (RS256) or INBOUND_TRUST_SECRET (HS256).
// See docs/identity.md for the full configuration reference.
// ---------------------------------------------------------------------------

function notConfigured(): never {
  throw new Error(
    "[auth/inbound-trust] Provider not configured. " +
      "Set AUTH_PROVIDER=inbound-trust and supply the required signing-key " +
      "environment variables (see docs/identity.md).",
  );
}

export const inboundTrustProvider: AuthProvider = {
  async getCurrentUser(): Promise<CurrentUser | null> {
    notConfigured();
  },

  async signIn(): Promise<CurrentUser> {
    notConfigured();
  },

  async signOut(): Promise<void> {
    notConfigured();
  },
};
