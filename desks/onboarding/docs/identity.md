# Identity Adapter — Architecture & Provider Guide

## Overview

All identity concerns in the Silverleaf Onboarding Hub flow through a single
adapter layer.  Routes, layouts, and server actions call one of four functions
and never touch cookies, headers, or tokens directly:

```
getCurrentUser()  → CurrentUser | null
requireUser()     → CurrentUser            (redirects to /sign-in if none)
requireAdmin()    → CurrentUser            (redirects to /unauthorized if not admin)
requireRole(role) → CurrentUser            (redirects to /unauthorized if missing role)
```

**Swapping providers requires ZERO changes at call sites.**  Only the
`AUTH_PROVIDER` environment variable needs updating.

---

## Provider Interface

```typescript
// src/lib/auth/provider.ts
interface AuthProvider {
  getCurrentUser(): Promise<CurrentUser | null>;
  signIn(email: string, fullName?: string): Promise<CurrentUser>;
  signOut(): Promise<void>;
}
```

Every provider must implement these functions.  The identity interface
(`src/lib/auth/identity.ts`) resolves the active provider at module-load time
via `AUTH_PROVIDER` and delegates all calls to it.

---

## AUTH_PROVIDER Switch

| Value            | Provider file                               | Status       |
|------------------|---------------------------------------------|--------------|
| `email` (default)| `src/lib/auth/providers/email.ts`           | Active       |
| `inbound-trust`  | `src/lib/auth/providers/inbound-trust.ts`   | Stub / planned |

Set `AUTH_PROVIDER` in `.env.local` (local dev) or in the Vercel / server
environment (production).  If unset, `email` is used.

---

## Interim Email Provider (`email`)

### Session storage

Sessions are stored in a single httpOnly cookie named `__Host-sla_session`
(or `__sla_session` over local http dev, where the `__Host-` prefix's mandatory
`Secure` attribute can't be set).

```
Format: <base64url(JSON payload)>.<HMAC-SHA256 signature>

Payload: { staffId: string; iat: number; exp: number }
```

- The cookie is `httpOnly`, `secure` (everywhere but local http dev), `sameSite: lax`.
- The signed payload carries an absolute `exp`; `getSession` rejects an expired
  or malformed payload, so a captured cookie can't be replayed past its lifetime.
- The HMAC is computed with Web Crypto (`crypto.subtle`) — no extra deps.

### Required environment variables

| Variable         | Required           | Description                                        |
|------------------|--------------------|----------------------------------------------------|
| `SESSION_SECRET` | Yes (prod)         | Random string (min 32 chars) for HMAC signing.  Dev falls back to an insecure constant with a console warning; production refuses to start without it. |
| `HR_ADMIN_EMAILS`| No                 | Comma-separated emails granted admin at sign-in.   |

### Sign-in flow

1. Normalize email (trim + lowercase).
2. Check `HR_ADMIN_EMAILS` policy (`isHrAdminEmail`).
3. `staffRepo.upsertStaffByEmail` — insert or touch existing row.
4. Write the session cookie with `staffId` (iat/exp stamped server-side).
5. Return `CurrentUser`.

### Admin access

Admin is determined solely by `staffRow.isAdmin`, which is set at sign-in from
the `HR_ADMIN_EMAILS` policy. `getCurrentUser` maps it to `roles: ["admin"]`.
(An earlier PIN-based self-elevation step was removed: it granted nothing a
HR-admin email didn't already have, so it was dead, unthrottled surface.)

---

## Inbound-Trust Provider (`inbound-trust`)

> **Status: stub.**  All functions throw `"Provider not configured"` until wired
> by the platform engineer.

This provider is designed for Mark's integration scenario: the school admin
platform (e.g. an HRMS) issues a signed JWT containing staff identity claims
and passes it to the onboarding hub on each request.  The hub verifies the
signature and maps claims to `CurrentUser` — no separate sign-in step required.

### Claim → CurrentUser Mapping

| JWT Claim   | CurrentUser field | Type            | Default  |
|-------------|-------------------|-----------------|----------|
| `sub`       | `id`              | `string`        | required |
| `email`     | `email`           | `string`        | required |
| `name`      | `fullName`        | `string \| null`| `null`   |
| `is_admin`  | `isAdmin`         | `boolean`       | `false`  |
| `roles`     | `roles`           | `string[]`      | `[]`     |
| `campus`    | `campus`          | `string \| null`| `null`   |
| `job_title` | `jobTitle`        | `string \| null`| `null`   |

### Required environment variables

| Variable                   | Algorithm | Description                              |
|----------------------------|-----------|------------------------------------------|
| `INBOUND_TRUST_JWKS_URL`   | RS256     | JWKS endpoint URL for public-key verification. |
| `INBOUND_TRUST_SECRET`     | HS256     | Shared secret for symmetric verification.|
| `AUTH_PROVIDER`            | —         | Must be set to `inbound-trust`.          |

Exactly one of `INBOUND_TRUST_JWKS_URL` or `INBOUND_TRUST_SECRET` should be
set.  If both are present, `JWKS_URL` takes precedence.

### Token delivery

The provider expects the JWT in one of two places (checked in order):

1. `Authorization: Bearer <token>` header.
2. `X-SLA-Identity` trusted header (set by an upstream proxy/edge function).

### Signing/verification expectations

- Algorithm: RS256 (asymmetric, preferred) or HS256 (symmetric).
- The `sub` claim must be a stable, unique staff identifier.
- The `exp` claim is enforced; expired tokens are rejected.
- The provider does NOT establish its own cookie session — the caller re-sends
  the token (or the proxy re-injects the header) on every request.

### Swapping from email to inbound-trust

1. Set `AUTH_PROVIDER=inbound-trust` in the server environment.
2. Supply `INBOUND_TRUST_JWKS_URL` or `INBOUND_TRUST_SECRET`.
3. Implement the verification logic in `src/lib/auth/providers/inbound-trust.ts`.
4. Deploy.  No application code outside `src/lib/auth/` needs to change.

---

## CurrentUser Shape

```typescript
interface CurrentUser {
  id: string;          // Stable UUID (staff table PK, or JWT `sub`)
  email: string;       // Normalized work email
  fullName: string | null;
  isAdmin: boolean;
  roles: string[];     // e.g. ["admin", "content-editor"]
  campus: string | null;
  jobTitle: string | null;
}
```

Defined in `src/lib/contracts/user.ts` — import from `@/lib/contracts`.

---

## Call-Site Patterns

```typescript
// Server Component or Route Handler — read-only
import { getCurrentUser, requireUser, requireAdmin } from "@/lib/auth";

// In a public page (no auth required)
const user = await getCurrentUser(); // null if not logged in

// In a protected layout
const user = await requireUser(); // redirects if not logged in

// In an admin-only page
const admin = await requireAdmin(); // redirects if not admin

// Fine-grained role check
const editor = await requireRole("content-editor");
```

```typescript
// Client Component triggering auth mutations (gated by the ed-admin directory)
"use client";
import { signInMemberAction, signOutMemberAction } from "@/lib/actions/member";
```
