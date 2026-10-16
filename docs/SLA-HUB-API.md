# Silverleaf Hub API

**For:** ShuleOne and other machine clients  
**Base URL (production):** `https://hub.silverleaf.co.tz`  
**Base URL (Vercel alias):** `https://sla-hub-nu.vercel.app`  
**Base URL (local):** `http://localhost:3100`  
**Version:** v1  
**Verified:** see [`SLA-HUB-API-VERIFIED.md`](./SLA-HUB-API-VERIFIED.md) — live HTTP results from `npm run hub-api:verify`

This API is **read-only**. It feeds workplace people and system metadata out of SLA Hub. It does not accept writes, and it never returns passwords, OTP codes, session secrets, or documents.

---

## Turn the API on (fixes HTTP 503)

ShuleOne cannot pull until **the hub** has `HUB_API_KEY` set. A key that exists only on ShuleOne is not enough — both sides need the **same** secret.

If you see:

```text
The key can't fetch data yet. Both hosts returned HTTP 503 with Hub API is not configured. Set HUB_API_KEY.
https://hub.silverleaf.co.tz/api/v1/people?limit=1 returned 503
```

do this once:

```bash
# 1) Generate a long random key (printed once — store in a password manager)
npm run shuleone:pull -- --generate-key

# 2) On the Hub Vercel project (Production + Preview), set:
#    HUB_API_KEY=<the key>
#    then redeploy Production.

# 3) On the ShuleOne server, set the same:
#    HUB_API_KEY=<the key>
#    HUB_API_BASE=https://hub.silverleaf.co.tz

# 4) Verify from this repo (or any machine with the key)
HUB_API_KEY=<the key> npm run shuleone:pull -- --verify
```

`GET /api/health` reports `"hubApi": true` when the hub key is configured (it never returns the key).

---

## Authentication

Every `/api/v1` request needs a bearer token.

```
Authorization: Bearer YOUR_HUB_API_KEY
```

Ask Silverleaf for `HUB_API_KEY`. Do not put it in git, tickets, or this document.

| Situation | HTTP | Body |
|---|---|---|
| Missing or wrong key | 401 | `{ "ok": false, "error": "Unauthorized" }` |
| Key not configured on the server | 503 | `{ "ok": false, "error": "Hub API is not configured. Set HUB_API_KEY." }` |
| Too many requests (60 / minute / IP) | 429 | `{ "error": "Too many requests" }` |

`GET /api/health` is public and does not use the key.

---

## Perfect pull (ShuleOne)

From this repository (or copy `scripts/shuleone-pull.mjs` into ShuleOne):

```bash
# Probe both production hosts
HUB_API_KEY=… npm run shuleone:pull -- --verify

# Full people directory (paginated). Upsert each row on email.
HUB_API_KEY=… npm run shuleone:pull -- --out=people.json

# Incremental after the first full pull
HUB_API_KEY=… npm run shuleone:pull -- --since=2026-10-01T00:00:00.000Z --out=people-delta.json

# Onboarding staff (includes startedAt)
HUB_API_KEY=… npm run shuleone:pull -- --staff --out=staff.json
```

Suggested ShuleOne sync loop:

1. Store `HUB_API_KEY` only on the ShuleOne server (and on Hub Vercel).
2. Prefer `https://hub.silverleaf.co.tz`; fall back to `https://sla-hub-nu.vercel.app`.
3. Poll `GET /api/v1/people` (optionally `?since=` after the first full pull).
4. Upsert each row on `email` (always lowercase).
5. Map `jobTitle` and `campus` onto ShuleOne staff fields.
6. Use `/staff` when you need onboarding `startedAt`.

Do not call hub admin, hiring, or bio routes. Those are for the hub UI, not for ShuleOne.

Local smoke / full verified report (hub running with the key set):

```bash
HUB_API_KEY=… npm run hub-api:smoke
HUB_API_KEY=… npm run hub-api:verify   # writes docs/SLA-HUB-API-VERIFIED.md
```

---

## Common response shape

Successful list endpoints:

```json
{
  "ok": true,
  "source": "sla-hub",
  "generatedAt": "2026-10-02T03:40:00.000Z",
  "count": 2,
  "data": []
}
```

**Stable person key for ShuleOne:** `email` (always lowercase). Upsert on email.

People endpoints only return addresses that contain `@`. Phone-number workboard rows are omitted.

---

## Endpoints

### 1. `GET /api/health`

Liveness. No key.

**200**

```json
{ "status": "ok", "database": true, "family": true, "hubApi": true }
```

`database` is `true` when the hub can reach Postgres.  
`hubApi` is `true` when `HUB_API_KEY` is set (≥ 32 characters).

---

### 2. `GET /api/v1`

Catalog of this API. Requires the key.

**200** lists every path below, plus the system ids ShuleOne can map to.

---

### 3. `GET /api/v1/people`

Everyone who has used a Silverleaf workplace app and has a work email.

| Query | Meaning | Default |
|---|---|---|
| `campus` | Exact-ish campus match (case-insensitive) | all |
| `app` | One system id (`onboarding`, `ops`, `data_tech`, `workboard`, `marketing`, …) | all |
| `q` | Search name or email | all |
| `since` | ISO timestamp; only people seen at or after this time | all |
| `limit` | Page size (max 500) | 200 |
| `offset` | Skip this many rows | 0 |

```bash
curl -H "Authorization: Bearer $HUB_API_KEY" \
  "https://hub.silverleaf.co.tz/api/v1/people?app=onboarding&limit=200"
```

**200 — one item in `data`**

```json
{
  "id": "a***@silverleaf.co.tz",
  "email": "a***@silverleaf.co.tz",
  "fullName": "A***",
  "jobTitle": "Teacher",
  "campus": "Main",
  "apps": ["onboarding"],
  "lastSeen": "2026-09-30T12:00:00.000Z"
}
```

`id` equals `email`. `lastSeen` may be `null`. `apps` is the list of hub systems that person has appeared in.

---

### 4. `GET /api/v1/people/{email}`

One person. URL-encode the email (`jane.doe%40silverleaf.co.tz`).

**200** — same object as above, inside `data` (no `count`).  
**404** — `{ "ok": false, "error": "Person not found" }`

---

### 5. `GET /api/v1/staff`

Onboarding staff rows. Same people as the onboarding desk, without admin secrets.

| Query | Meaning | Default |
|---|---|---|
| `campus` | Campus filter | all |
| `q` | Search name or email | all |
| `limit` | Page size (max 500) | 200 |
| `offset` | Skip this many rows | 0 |

**200 — one item in `data`**

```json
{
  "id": "3f2c…uuid",
  "email": "a***@silverleaf.co.tz",
  "fullName": "A***",
  "campus": "Main",
  "jobTitle": "Teacher",
  "lastActiveAt": "2026-09-30T12:00:00.000Z",
  "startedAt": "2026-01-15T08:00:00.000Z",
  "createdAt": "2026-01-10T08:00:00.000Z"
}
```

Prefer `/people` for a cross-app directory. Use `/staff` when ShuleOne needs onboarding start dates.

---

### 6. `GET /api/v1/campuses`

Distinct campus names from the people directory.

**200**

```json
{
  "ok": true,
  "count": 1,
  "data": [{ "id": "Main", "name": "Main" }]
}
```

---

### 7. `GET /api/v1/systems`

Workplace systems the hub knows about. Use `id` when you filter `/people?app=`.

| id | Name | Live site |
|---|---|---|
| `hub` | Hub / Code | https://hub.silverleaf.co.tz |
| `ops` | Ops | https://ops-transport-system.vercel.app |
| `onboarding` | Onboarding | https://onboarding.silverleaf.co.tz |
| `marketing` | Marketing | https://sla-marketing-web.vercel.app |
| `data-tech` | Data & Tech | https://dataandtech.silverleaf.co.tz |
| `talent-academy` | Talent Academy | https://talent-academy-sla.vercel.app |
| `uniforms` | Uniforms | https://school-uniforms-lyart.vercel.app |
| `visitors` | Visitors | https://v-isitors.vercel.app |
| `workboard-tasks` | Workboard Tasks | https://silverleaf-tasks.vercel.app |
| `lesson-plans` | Lesson Plans | https://silverleaf-lesson-plans-main.vercel.app |
| `mel-dashboard` | MEL Dashboard | https://silverleafmeldashboard-production.up.railway.app/#overview |

`/people?app=` uses the **schema** names: `onboarding`, `ops`, `data_tech`, `workboard`, `marketing`, `talent`, `uniforms`, `visitors`, `lesson_plans`, `mel`.

---

## Errors

| HTTP | When |
|---|---|
| 401 | No key or wrong key |
| 404 | Person email not found |
| 429 | Rate limit |
| 502 | Directory database briefly unreachable |
| 503 | `HUB_API_KEY` not set on the hub |

---

## Verification (2 October 2026)

Checked against `http://127.0.0.1:3100` with a valid local key.

| Check | Result |
|---|---|
| `GET /api/health` without a key | 200, database true |
| `GET /api/v1` without a key | 401 |
| `GET /api/v1` with a bad key | 401 |
| `GET /api/v1` catalog | 200, 6 endpoints |
| `GET /api/v1/people?limit=2` | 200 |
| `GET /api/v1/people?app=onboarding` | 200 |
| `GET /api/v1/people/{email}` | 200, email matches |
| `GET /api/v1/people/nobody@…` | 404 |
| `GET /api/v1/staff?limit=2` | 200 |
| `GET /api/v1/campuses` | 200 |
| `GET /api/v1/systems` | 200, 11 systems |

Production (`https://hub.silverleaf.co.tz` and the Vercel alias) needs `HUB_API_KEY` set on the sla-hub Vercel project before ShuleOne can call it there.
