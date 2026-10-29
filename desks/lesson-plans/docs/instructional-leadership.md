# Instructional Leadership board

Campus walkthroughs and teacher observations for the five campuses (Usa River, Arusha Modern, Kijenge, Ilboru, Boma), as a board inside Academics at `/{locale}/leadership`.

The page is the original Apps Script dashboard (`integrations/instructional-leadership/Index.html`, unchanged). The hub serves it with a small stand-in for `google.script.run`, so the figures come from the Academics database instead of from Google.

## How the data gets here

```
Google trackers ──(Apps Script, hourly)──▶ POST /api/leadership/ingest ──▶ Neon (Academics DB) ──▶ /api/leadership/data ──▶ board
```

1. The trackers stay the source of truth. `Code.gs` (unchanged) reads them and works out the figures.
2. `PushToHub.gs` sends that payload to the hub every hour, with `Authorization: Bearer <key>`.
3. The hub validates it (`src/lib/leadership/schema.ts`) and **replaces** the stored snapshot in one transaction. A failed push leaves the last good snapshot.
4. The board reads the snapshot. Until the first push it says no figures have been synced.

## Database

Four tables in the Academics Neon database (`CURRICULUM_DATABASE_URL`), beside `assessment_records`, `kg_records`, `curriculum_feedback`, `curriculum_coverage` and `pd_feedback`:

| Table | Holds |
|---|---|
| `ild_walkthroughs` | one row per walkthrough (JSON payload + date, term, campus, facilitator) |
| `ild_observations` | one row per teacher observation |
| `ild_config` | campuses, terms, PD lists, observation rules, sources, `generatedAt` |
| `ild_sync_log` | one row per push: counts only, newest 200 kept |

Migration: `db/neon/0001_instructional_leadership.sql` (additive, idempotent). `src/lib/leadership/store.ts` runs the same statements on first use.

## Setup (once)

1. Generate a key: `openssl rand -hex 32`.
2. Vercel project `silverleaf-lesson-plans-main` → Environment Variables → `ILD_INGEST_KEY` = that key (Production). Redeploy.
3. In the Apps Script project, add `PushToHub.gs`, then Project Settings → Script properties:
   - `HUB_INGEST_URL` = `https://silverleaf-lesson-plans-main.vercel.app/api/leadership/ingest`
   - `HUB_INGEST_KEY` = the same key
4. Run `pushToHub` once by hand, then `installHourlyPush` once.

Without `ILD_INGEST_KEY`, the ingest endpoint answers 503 and accepts nothing.

## Who can see it

Academics admins (`HR_ADMIN_EMAILS`, or a session raised with `ADMIN_PIN`) and the work emails listed in `ILD_VIEWER_EMAILS` (comma-separated: principals, coaches, heads of academics). Sign-in only ever grants the `admin` role, so anyone else who should see the board must be on that list. On Vercel: add or edit `ILD_VIEWER_EMAILS` for Production, then redeploy. Other staff go to Unauthorized; signed-out visitors go to sign-in. The page names teachers and carries observation notes, so unlike the KG and Assessment boards there is no anonymised public view. The page and data are never cached (`private, no-store`), and the board is not saved by the Academics offline service worker.

## Checks

```bash
npx vitest run src/lib/leadership          # schema, auth, SQL on PGlite, routes, page
SMOKE_BASE=http://127.0.0.1:3399 node scripts/smoke-leadership.mjs   # running server
```

`scripts/smoke-leadership.mjs` never writes unless `SMOKE_WRITE=1`. `.env.local` here points at the real Academics database, so only do that against a throwaway one.

After editing `Index.html`, run `node integrations/instructional-leadership/build-template.mjs` (a test fails if the generated copy is stale).
