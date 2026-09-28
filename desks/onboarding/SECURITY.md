# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

This is an internal Silverleaf Academy application. Do **not** open public GitHub issues for security concerns.

Report issues privately to:

- **HR / IT:** hr@silverleaf.co.tz

Include steps to reproduce, affected URLs, and any relevant logs.

## Secrets and API keys

- Never commit `.env`, `.env.local`, or production credentials. Example files (`.env.example`, `.env.production.example`) hold placeholders only.
- `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `ED_ADMIN_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `TURNSTILE_SECRET_KEY`, SMTP, and Google OAuth values are **server-only**. Do not prefix them with `NEXT_PUBLIC_`.
- Rotate any secret that ever lived in git (including the old bootstrap PIN that was previously in `.env.example` history). History rewrite + force-push is a coordinated ops step, not done from the app. CI scans the working tree with Gitleaks (`gitleaks.toml`).

## Database (public vs owner key)

There is no browser-facing database key. The Next.js server is the only client of Postgres/PGlite.

- `DATABASE_URL` is the private owner connection (service-role analog) used for migrations.
- `DATABASE_PUBLIC_URL` is the optional least-privilege / public-anon analog for request traffic. RLS in migration `0019_row_level_security` applies to that non-owner role. The table owner bypasses RLS. Leave both empty locally to use embedded PGlite.
- Request traffic on `DATABASE_PUBLIC_URL` sets `app.current_staff_id`, `app.is_admin`, and `app.hiring_token` (token-gated hiring uploads) via `SET LOCAL` in a transaction so pooled connections cannot leak another request's context.
- Hiring tables are admin-only (`app.is_admin`) except public apply INSERT of `new` / `incomplete_application` rows and token-gated SELECT/UPDATE for culture, performance, and IT-onboarding links.
- Catalog tables are readable by any request role; writes stay admin-only. Member PII tables are self-or-admin.
- Bio PII (IDs, bank, phones, legal notes) and hiring notes / culture-video feedback are encrypted at rest with AES-256-GCM (`enc:v1:` prefix). Set `DATA_ENCRYPTION_KEY` in production.

## Authentication and sessions

- Session cookies are HMAC-signed, httpOnly, `SameSite=Lax`, `Secure` in production (`__Host-sla_session`), 15-minute sliding idle. The signed payload is `{ staffId, isAdmin, iat, exp }` so RLS can set `app.is_admin` before the first query. `getCurrentUser()` still re-reads `staff.is_admin` from the database.
- Admin passwords are scrypt-hashed (`N=16384,r=8,p=1`) with `timingSafeEqual`. Bootstrap `ADMIN_PASSWORDS` are placeholders; stored hashes win after first change. Bootstrap PIN comparison is also constant-time.
- OTPs are hashed with a `SESSION_SECRET` pepper and rate-limited (3 / 5 minutes).
- Member ids, admin flags, and hiring tokens are resolved server-side. Clients cannot set `isAdmin`, `memberId`, `stage`, or pipeline tokens. Hiring admin mutations use Zod `.strict()` allowlists. Bio forms use Zod `.strict()`. Admin settings accept only `it_email`.
- Sign-in is rate-limited (8 attempts / 15 minutes per email).

## Hiring admin APIs

- Every hiring admin route goes through `requireAdminApi()` (session `isAdmin`, not a client flag).
- Candidate ids must be UUIDs. Mutation responses omit upload/onboarding tokens and return `{ id, stage, … }` only.
- File downloads (`/api/hiring/download`, `/api/hiring/files/*`) are HR-only, `nosniff`, `no-store`, attachment. Path traversal is rejected.

## APIs, uploads, and content

- `/api` is rate-limited in middleware (health 60/min, apply 8/15min, hiring-public 20/15min, hiring-admin 60/min, default 120/min).
- Public apply: Zod validation, honeypot + minimum fill time, optional Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`), trimmed `{ ok: true }` response. HR manual entry uses the same extra fields (phone, location, …) stored as encrypted notes.
- Queries go through Drizzle (parameterized). User content in HTML emails is escaped.
- Uploads: bio 10 MB (documents/images); hiring 25 MB (videos/docs); admin materials 500 MB with a MIME allowlist. SVG/HTML are rejected. Blob downloads only from `*.blob.vercel-storage.com`.
- `/api/health` returns `{ status, database }` only — it does not probe ed-admin with the API token.

## Logging

Security events (`[security]`) record event names and routes. Do not log emails, tokens, passwords, or field values.
