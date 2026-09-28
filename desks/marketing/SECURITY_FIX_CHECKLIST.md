# Security & Ops Hardening Checklist

Branch: `fix/security-and-ops-hardening`  
Started: 2026-07-22

---

## Critical

- [x] **C1** Authenticate webhooks (Buffer inbound + Ed Admin) with shared secrets
- [x] **C2** Allowlist `additional_roles` (no privilege escalation)
- [x] **C3** Enforce must-change-password (API + persist frontend)
- [x] **C4** Harden public `/api/apply` (no funnel skip / rate limit)

## High

- [x] **H1** `requireRole` on all module GET routes
- [x] **H2** Campus scoping on ID mutations (leads, payments, inventory, tours, campaigns, interviews, SE findings, referrals, purchases, events, chronic flags, quotations)
- [x] **H3** Run migrations `002`–`006` via `db:migrate`
- [x] **H4** Cron secret fail-closed + safe CORS default

## Medium

- [x] **M1** WhatsApp → SMS fallback + form-reminder includes Ed Admin link
- [x] **M2** Drug-expiry cron actually notifies nurses
- [x] **M3** Stop returning `defaultPassword` in API; clearer send failure logs

## Other

- [x] **O1** Frontend Guard honors `additionalRoles` + forced password redirect
- [x] **O2** Scrub route `err.message` 500 leaks via `sendServerError`
- [x] **O3** Validate payment amounts (positive number)
- [x] **O4** Document new env vars (`WEBHOOK_SECRET`, `AT_WA_NUMBER`, etc.)
- [x] **O5** Fix dispensary global stats SQL (`FROM ... AND` bug)
- [x] **O6** HTML-escape email interpolations
- [x] **O7** API interceptor redirects on `MUST_CHANGE_PASSWORD`
- [x] **O8** Rate-limit login (20 attempts / 15 min)

## Verification

- [x] Smoke tests (`npm run test:security` — 11/11)
- [x] Live API smoke against Supabase (health, webhooks, login, role gates, apply)
- [ ] Browser UI smoke
- [ ] Push branch + open PR (needs GitHub remote URL)

## Login for local UI

- URL: http://127.0.0.1:3000
- Email: `marketing@silverleaf.co.tz`
- Password: `TestPass123!`

---

## Commit log

| Commit | Items |
|--------|-------|
| e57417f | C1–C4, H1–H4, M1–M3, O1–O5 |
| 0f760aa | backend .env.example tracking |
| 387b41a | IDOR sweep, safe errors, HTML escape |
| 02e34a5 | Supabase SSL + soft-fail service role |
| f8cb4ef | frontend lockfile |
| 14a2418 | login rate-limit + remaining IDOR |
