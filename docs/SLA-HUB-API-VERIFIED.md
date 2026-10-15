# SLA Hub API — verified endpoint report

**Base tested:** `http://127.0.0.1:3100`  
**Generated:** 2026-10-15T02:02:06.330Z  
**Result:** **11/11 checks passed**  
**Auth:** `Authorization: Bearer $HUB_API_KEY` (key length 48; value not recorded)

This file was produced by `npm run hub-api:verify` against a running hub. Every row below is a live HTTP call.

## Checklist

| Result | Request | HTTP | Time | Notes |
|---|---|---|---|---|
| PASS | `GET /api/health` | 200 | 64 ms | status=ok database=true hubApi=true |
| PASS | `GET /api/v1` | 401 | 38 ms | Unauthorized |
| PASS | `GET /api/v1` | 401 | 28 ms | Unauthorized |
| PASS | `GET /api/v1` | 200 | 34 ms | 6 endpoints; systems=11 |
| PASS | `GET /api/v1/people?limit=5` | 200 | 26 ms | count=2 |
| PASS | `GET /api/v1/people/amina.teacher%40silverleaf.co.tz` | 200 | 52 ms | email=amina.teacher@silverleaf.co.tz |
| PASS | `GET /api/v1/people/nobody@silverleaf.co.tz` | 404 | 26 ms | Person not found |
| PASS | `GET /api/v1/people?app=onboarding&limit=5` | 200 | 32 ms | count=2 |
| PASS | `GET /api/v1/staff?limit=5` | 200 | 34 ms | count=1 |
| PASS | `GET /api/v1/campuses` | 200 | 26 ms | count=2 |
| PASS | `GET /api/v1/systems` | 200 | 31 ms | count=11 |

## Auth rules confirmed

| Situation | Expected | Observed |
|---|---|---|
| No bearer token on `/api/v1` | 401 | 401 |
| Wrong bearer token | 401 | 401 |
| Valid bearer token | 200 | 200 |
| Public `/api/health` | 200, includes `hubApi` | 200, hubApi=true |

## Endpoint reference (tested)

### `GET /api/health` — public

```json
{
  "status": "ok",
  "database": true,
  "family": false,
  "hubApi": true
}
```

### `GET /api/v1` — catalog

```json
{
  "ok": true,
  "source": "sla-hub",
  "purpose": "Read-only workplace data for ShuleOne. Email is the stable person key.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/v1",
      "description": "This catalog"
    },
    {
      "method": "GET",
      "path": "/api/v1/people",
      "description": "Everyone who has used a Silverleaf app",
      "query": [
        "campus",
        "app",
        "q",
        "since",
        "limit",
        "offset"
      ]
    },
    {
      "method": "GET",
      "path": "/api/v1/people/{email}",
      "description": "One person by work email"
    },
    {
      "method": "GET",
      "path": "/api/v1/staff",
      "description": "Onboarding staff records (no secrets)",
      "query": [
        "campus",
        "q",
        "limit",
        "offset"
      ]
    },
    {
      "method": "GET",
      "path": "/api/v1/campuses",
 
…
```

### `GET /api/v1/people`

Query params exercised: `limit`, `app`.

```json
{
  "ok": true,
  "source": "sla-hub",
  "count": 2,
  "sample": {
    "id": "amina.teacher@silverleaf.co.tz",
    "email": "amina.teacher@silverleaf.co.tz",
    "fullName": "Amina Teacher",
    "jobTitle": "Teacher",
    "campus": "Main",
    "apps": [
      "onboarding"
    ],
    "lastSeen": "2026-10-15T01:59:52.816Z"
  }
}
```

Stable ShuleOne upsert key: `email`.

### `GET /api/v1/people/{email}`

Fetched `amina.teacher@silverleaf.co.tz` → HTTP 200.

Missing email → HTTP 404 with `Person not found`.

### `GET /api/v1/staff`

```json
{
  "ok": true,
  "source": "sla-hub",
  "count": 1,
  "sample": {
    "id": "4cada549-59ad-4048-81d0-a1c8cf241597",
    "email": "amina.teacher@silverleaf.co.tz",
    "fullName": "Amina Teacher",
    "campus": "Main",
    "jobTitle": "Teacher",
    "lastActiveAt": "2026-10-15T01:31:14.465Z",
    "startedAt": null,
    "createdAt": "2026-10-15T01:31:14.465Z"
  }
}
```

### `GET /api/v1/campuses`

```json
{
  "ok": true,
  "source": "sla-hub",
  "generatedAt": "2026-10-15T02:02:05.806Z",
  "count": 2,
  "data": [
    {
      "id": "Main",
      "name": "Main"
    },
    {
      "id": "Usa River",
      "name": "Usa River"
    }
  ]
}
```

### `GET /api/v1/systems`

```json
{
  "ok": true,
  "count": 11,
  "ids": [
    "hub",
    "ops",
    "onboarding",
    "marketing",
    "data-tech",
    "talent-academy",
    "uniforms",
    "visitors",
    "workboard-tasks",
    "lesson-plans",
    "mel-dashboard"
  ]
}
```

## Curl recipes (same base)

```bash
export HUB_API_BASE="http://127.0.0.1:3100"
export HUB_API_KEY  # min 32 chars; never commit

curl -sS "$HUB_API_BASE/api/health"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1/people?limit=200"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1/people/amina.teacher%40silverleaf.co.tz"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1/staff?limit=200"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1/campuses"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \
  "$HUB_API_BASE/api/v1/systems"
```

## ShuleOne pull (also verified when key is set)

```bash
HUB_API_KEY=… npm run shuleone:pull -- --base=http://127.0.0.1:3100 --verify
HUB_API_KEY=… npm run shuleone:pull -- --base=http://127.0.0.1:3100 --out=people.json
```

## Production note

`https://hub.silverleaf.co.tz` and `https://sla-hub-nu.vercel.app` return **503** on `/api/v1` until `HUB_API_KEY` is set on the Hub Vercel project. After that env is live, re-run:

```bash
HUB_API_KEY=… SMOKE_BASE=https://hub.silverleaf.co.tz npm run hub-api:verify
```

Raw response captures from this run are under `/opt/cursor/artifacts/hub-api-verify`.
