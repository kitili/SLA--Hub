# Silverleaf Hub API

**For:** ShuleOne and other machine clients  
**Base URL (production):** `https://sla-hub-nu.vercel.app`  
**Base URL (local):** `http://localhost:3100`  
**Version:** v1  
**Verified:** 2 October 2026 — 11 of 11 checks passed against the live local hub

This API is **read-only**. It feeds workplace people and system metadata out of SLA Hub. It does not accept writes, and it never returns passwords, OTP codes, session secrets, or documents.

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
{ "status": "ok", "database": true }
```

`database` is `true` when the hub can reach Postgres.

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
  "https://sla-hub-nu.vercel.app/api/v1/people?app=onboarding&limit=200"
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
| `hub` | Hub / Code | https://sla-hub-nu.vercel.app |
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

## Suggested ShuleOne sync

1. Store `HUB_API_KEY` only on the ShuleOne server.
2. Poll `GET /api/v1/people` (optionally `?since=` after the first full pull).
3. Upsert each row on `email`.
4. Map `jobTitle` and `campus` onto ShuleOne staff fields.
5. Ignore `/api/health` except for uptime.

Do not call hub admin, hiring, or bio routes. Those are for the hub UI, not for ShuleOne.

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

Production (`https://sla-hub-nu.vercel.app`) needs the same `HUB_API_KEY` set on the sla-hub Vercel project before ShuleOne can call it there.
