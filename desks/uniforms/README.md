# Silverleaf Uniform Tracker

Next.js app for **five campuses**: tailoring, two warehouses, parent FIFO orders, Imani’s distribution, purchase orders, sewing/SLM, and finance.

**Start here:** [docs/GOING-FORWARD.md](./docs/GOING-FORWARD.md)  
Also: [Planning report (Word)](./docs/Silverleaf-Uniform-Tracker-Planning-Report.docx) · [PDF](./docs/Silverleaf-Uniform-Tracker-Planning-Report.pdf) · [Markdown source](./docs/ARCHITECTURE.md) · [SRS](./docs/SRS.md) · [SPRINTS](./docs/SPRINTS.md) · [CURRENT](./docs/CURRENT.md) · [Excel snapshot](./docs/source/EXCEL-IMPORT.md)

## Run it

```bash
npm install
cp .env.example .env
npm run db:setup    # local demo: set DATABASE_URL=file:./dev.db in .env first
npm run dev
```

**Live app:** https://school-uniforms-lyart.vercel.app  

**Production (Vercel):** Supabase Postgres — set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` in Vercel env. Run `npm run db:setup` once against that database to seed desks.

Local dev: http://localhost:3000 (or whatever port `npm run dev` prints)

### Staff login (email + password)

**Password for every staff desk:** `Silverleaf@2026`  
On `/login`, tap a desk button or type the email below.

| Desk | Email | Role |
|------|-------|------|
| Leadership (CEO briefing) | ceo@silverleaf.ac.tz | CEO |
| Imani (store, distribution & finance) | imani@silverleaf.ac.tz | STORE |
| Loveness (tailor + Usa River shop) | loveness@silverleaf.ac.tz | TAILOR |
| Usa River admin | usa.admin@silverleaf.ac.tz | ADMIN |
| Arusha Town admin | am.admin@silverleaf.ac.tz | ADMIN |
| Kijenge head teacher | kijenge.ht@silverleaf.ac.tz | HEAD_TEACHER |
| Boma head teacher | boma.ht@silverleaf.ac.tz | HEAD_TEACHER |
| Ilboru head teacher | ilboru.ht@silverleaf.ac.tz | HEAD_TEACHER |

### Parent login (registration number — no password)

| Child | Reg number | Notes |
|-------|------------|-------|
| Amina Juma | `SLA/UR/2023/312` | Usa River — links Baraka as sibling |
| Baraka Ally | `SLA/UR/2024/088` | Same family as Amina |
| Neema Paul | `SLA/AM/2024/101` | Arusha Town |
| Daniel Mushi | `SLA/KJ/2024/055` | Kijenge (cross-campus sibling test) |
| Grace Mollel | `SLA/IL/2023/210` | Ilboru |
| Ibrahim Said | `SLA/BM/2024/017` | Boma |

With **Ed-admin** configured (`EDADMIN_GENERAL_API_KEY`), parents can use any live **AdmNo** from Ed-admin — see [docs/EDADMIN.md](./docs/EDADMIN.md).

`db:setup` is safe to re-run: it resets and reseeds the database.

```bash
node scripts/workbot.mjs status
node scripts/smoke-roles.mjs          # app must be running
```

## Demo walkthrough (Imani & Loveness)

1. **Loveness** (`loveness@…`) — Sewing: add a job, complete it so pieces land in MAIN. SLM: log jora/fabric and labour.
2. **Imani** (`imani@…`) — Desk map → Stock (all locations) → Purchase orders: receive into **MAIN only** → transfer some qty to the shop.
3. **Usa admin** — Requests: ask Imani for polos. **Imani** posts a delivery note. Print the DN.
4. **Parent** — Login with `SLA/UR/2023/312` (Amina + Baraka). Switch **Kiswahili**. When paid, **Njoo uchukue / Come collect**.
5. **Loveness** — Cloth (`/slm`). Home shows cloth shortfall alerts.
6. **Usa admin or Imani** — Coupon → **Kit ready** + WhatsApp, then Received all / few. Home shows low sizes. `/audit` is who touched stock/pay. `/train` is the walkthrough. Print `/size-chart` for the shop wall.
7. **Leadership** (`ceo@…`) — **CEO briefing** (`/reports`): kit coverage, campus drill-in, weekly pack (print / WhatsApp / copy). Read-only. Campus admin/HT still see their site only.
8. **Finance** — Budget vs POs, then Sizes → class fit chart, refresh 2027 buy plan.

## Stack

Next.js App Router + TypeScript + Tailwind + Prisma (SQLite locally, Postgres on Vercel). Integer **TZS**. Cookie session, 7 days. Ed-admin optional: [EDADMIN.md](./docs/EDADMIN.md). Postgres note: [ROADMAP](./docs/ROADMAP.md).
