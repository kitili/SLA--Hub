<p align="center">
  <img src="public/assets/branding/brandmark-electric-blue.svg" alt="Silverleaf Academy" width="300" />
</p>

<h1 align="center">Silverleaf Lesson Plans</h1>

<p align="center">
  Lesson-plan library for <strong>Silverleaf Academy</strong> — find, view, and manage lesson plans, capture teacher feedback, and generate plans with AI.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Postgres-Neon-4169E1?logo=postgresql&logoColor=white" alt="Postgres (Neon)" />
  <img src="https://img.shields.io/badge/License-Proprietary-002368" alt="License" />
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#authentication">Authentication</a> ·
  <a href="#deploy-to-vercel">Deploy</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

> **Taking over this project?** Start with [**HANDOVER.md**](./HANDOVER.md) —
> secrets checklist + copy-paste agent prompts that rebuild the full setup on a
> fresh Vercel account.

## What it does

- **Search & browse** — find lesson plans by grade, subject, term, and week; faceted filters and an "upcoming this week" view for teachers.
- **Plan detail** — view a plan as the branded booklet or the official Tanzanian government form, download that government form as a PDF, record usage, and leave structured feedback (with a points/streak system to encourage it).
- **AI Studio** — generate structured lesson plans with an LLM (via OpenRouter): pick a scheme-of-work lesson as grounding, preview the branded document, then save and publish — single plans, or batches via an in-browser worker pool (keep the tab open while a batch runs). The model and the prompt building-blocks are set once in the **Settings** tab (behind a warning) and resolved server-side, not tuned per generation.
- **Schemes of work** — upload term schemes as `.docx`/CSV; the parsed 11-column lesson rows drive AI generation (`/admin/ai-studio/schemes`).
- **Textbook databank** — upload textbook PDFs and OCR every page, or import the bundled 37-book corpus (`/admin/ai-studio/textbooks`).
- **Admin dashboard** — staff/admin oversight of plans, usage, feedback, and search misses at `/admin`.
- **Bilingual UI** — English (`en`) and Swahili (`sw`); locale prefix routes (`/en/…`, `/sw/…`).
- **Zero-setup local dev** — embedded [PGlite](https://electric-sql.com/docs/api/clients/pglite) when `DATABASE_URL` is unset.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Database ORM | Drizzle ORM (PGlite locally, postgres-js on Vercel) |
| AI | Vercel AI SDK + OpenRouter — generation default `deepseek/deepseek-v4-pro`, OCR default `google/gemini-3.5-flash`; durable textbook OCR ingest via Workflow DevKit |
| i18n | next-intl v4 — EN + SW |
| File storage | Local filesystem locally; Vercel Blob in production |
| Hosting | Vercel |

## Quick start

Requires **Node ≥ 22.6** (the db scripts run TypeScript via
`--experimental-strip-types`).

```bash
npm install
npm run db:seed             # seeds demo data into embedded PGlite (runs migrate first)
npm run db:import-textbooks # optional: load the bundled textbook OCR corpus
npm run dev                 # http://localhost:3000
```

No environment variables are required for local development. Sign in at
`/sign-in` with a seeded demo account and **any non-empty Staff ID**:

- Teacher — `teacher@silverleaf.co.tz`
- HR / admin — `hr@silverleaf.co.tz`

## Authentication

Staff sign in with their work email + ed-admin **Staff ID**, verified against
the ed-admin staff directory (`ED_ADMIN_API_TOKEN`) in production. Locally,
sign-in falls back to the seeded staff table and accepts any Staff ID. In
production that fallback is disabled — without the token sign-in fails closed
unless `ALLOW_DEMO_AUTH=1` explicitly opts a demo deployment in.

Emails listed in `HR_ADMIN_EMAILS` are granted admin access (`/admin`) at
sign-in. In production the auth cookie is signed with `SESSION_SECRET`
(required). See [`docs/identity.md`](docs/identity.md).

## Deploy to Vercel

Full runbook: [**DEPLOYMENT.md**](./DEPLOYMENT.md) (Postgres/Blob provisioning,
exact env vars, migrations, troubleshooting). Taking over the project? Use the
agent prompts in [**HANDOVER.md**](./HANDOVER.md).

Short version:

1. `vercel link` the repo to a Vercel project.
2. Add **Vercel Postgres (Neon)** — auto-injects `DATABASE_URL`.
3. Add **Vercel Blob** — auto-injects `BLOB_READ_WRITE_TOKEN`.
4. Set `SESSION_SECRET`, `HR_ADMIN_EMAILS`, `ED_ADMIN_API_TOKEN`, and
   `OPENROUTER_API_KEY` (optional: `AI_MODEL_ID`, `AI_OCR_MODEL_ID`).
5. Prepare the production DB: `DATABASE_URL=<prod-url> npm run db:migrate`
   (then `db:seed` and `db:import-textbooks` — see DEPLOYMENT.md §4).
6. Deploy with `vercel --prod` (or push to the production branch).

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo data + AI prompt parts |
| `npm run db:import-textbooks` | Import the bundled textbook OCR corpus |

## Documentation

| Doc | Contents |
| --- | --- |
| [CLAUDE.md](./CLAUDE.md) | Orientation for AI agents: gotchas, conventions, layout |
| [`docs/environment.md`](docs/environment.md) | Environment variables |
| [`docs/data-layer.md`](docs/data-layer.md) | Drizzle, migrations, repositories |
| [`docs/schema-conventions.md`](docs/schema-conventions.md) | Table/column naming, bilingual columns |
| [`docs/identity.md`](docs/identity.md) | Auth providers |
| [`docs/i18n.md`](docs/i18n.md) | Locales and messages |
| [`docs/ai-studio.md`](docs/ai-studio.md) | AI Studio architecture (single + batch generation) |
| [`docs/server-actions.md`](docs/server-actions.md) | The `ActionResult` contract |
| [`docs/materials.md`](docs/materials.md) | File storage adapters |
| [`docs/typescript.md`](docs/typescript.md) | Strict TS configuration |
| [**HANDOVER.md**](./HANDOVER.md) | Tech handover: secrets checklist + copy-paste agent prompts |
| [**DEPLOYMENT.md**](./DEPLOYMENT.md) | Vercel deployment runbook + local dev + troubleshooting |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](./SECURITY.md) | Security policy |

## License

Proprietary — internal use by **Silverleaf Academy** only. See [LICENSE](./LICENSE).

<p align="center">
  <sub>Silverleaf Academy · The Future Starts Here</sub>
</p>
