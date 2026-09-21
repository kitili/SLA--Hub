# Silverleaf Hub

One workplace for Silverleaf Academy departments: **Onboarding**, **Talent Academy**, **Ops**, **Uniforms**, **Marketing**, **Data & Tech**, and **Visitors**.

Sign in here once. Onboarding runs in this app. The other desks live as their own repos under `desks/` and open on a unique local port when they are running, otherwise their live Vercel site.

## Run the hub

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3100](http://localhost:3100). Use an `@silverleaf.co.tz` or `@silverleaf.ac.tz` address. In development the OTP is printed in the terminal and on the sign-in screen.

## Bring the other systems here

Each live site has its own GitHub repo. This hub does **not** copy those apps into one Next.js tree (they use different frameworks, databases, and logins). It clones the current production branch into `desks/` so you can work on them from this workspace and keep them aligned with live.

```bash
npm run desks:sync
```

| Department | In this workspace | Live site | Local |
|---|---|---|---|
| Hub | this app | — | http://localhost:3100 |
| Onboarding | in-app `/en`, source at `desks/onboarding` | https://sla-onboarding-hub-steel.vercel.app | http://localhost:3000 |
| Talent Academy | `desks/talent-academy` | http://localhost:8765 (your training planner) | http://localhost:8765 |
| Ops | `desks/ops` | https://ops-transport-system.vercel.app | http://localhost:3020 |
| Uniforms | `desks/uniforms` | https://school-uniforms-lyart.vercel.app | http://localhost:3010 |
| Marketing | `desks/marketing/web` | https://sla-marketing-web.vercel.app | http://localhost:3180 |
| Data & Tech | `desks/data-tech` | https://data-and-tech.vercel.app | http://localhost:4050 |
| Visitors | `desks/visitors` | http://localhost:3108 (visitor log + visit records) | http://localhost:3108 |

Visit records live in SQLite (`data/visits.db`) plus photos, not in git. Pull them into this workspace any time with:

```bash
npm run visitors:sync
```

`npm run desks:sync` does that as well. To copy again as soon as someone signs in:

```bash
npm run visitors:sync:watch
```

Start the external desks together:

```bash
npm run desks:dev
```

Then click a card on the hub. If that port is up, you enter the local copy. If not, you enter live.

## Align every day

Current SHAs are written to `desks.lock.json`.

**On this machine (recommended):**

```bash
npm run desks:sync:daily
```

That installs a 06:00 crontab that runs `npm run desks:sync`. Run it now any time with `npm run desks:sync`. Check SHAs with `npm run desks:status`.

**On GitHub:** `.github/workflows/sync-desks.yml` runs at 06:00 East Africa Time and commits the lockfile. Give the workflow a token that can read the private desk repos, or keep using the local cron.

Work in each desk the usual way (`cd desks/ops`, branch, PR, push). Do not merge those apps into `src/` — pull them, do not paste them.

## Auth

OTP is the same pattern as the Onboarding Hub: work email → 6-digit code → httpOnly cookie on this device (8 hours). Many people can be signed in at once; each browser has its own cookie.

Ops, Uniforms, Marketing, Data & Tech, Talent Academy, and Visitors still have their own logins until every app shares `*.silverleaf.co.tz` and one parent-domain session.
