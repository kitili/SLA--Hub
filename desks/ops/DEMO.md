# Majundo Ops — Soft-launch demo script

**Audience:** School leadership (10 minutes)  
**Owner:** Irene (Week 3 Day 15)  
**Prep:** Seed finance (`supabase/seed_finance.sql`). For the optimize beat, load the demo route **after** Week 2 schemas + roster + real fleet:

1. `schema_week2.sql`
2. `seed_silverleaf.sql`
3. `seed_routes.sql` (18 real AM routes — do not skip)
4. `seed_majundo_demo_route.sql` → **Majundo Soft-Launch Demo AM** (suboptimal stop order)

Also: print QR sheets (`/matron/students/print`), admin + matron logins ready.

---

## One-pager (leave-behind)

**Majundo / Silverleaf transport ops** ties boarding, fleet, and money in one loop:

| Moment | What leadership sees |
|--------|----------------------|
| Boarding | Matron scans QR → student aboard → fee note on scan |
| Parents | SMS/stub on board → Messages panel shows today’s sends |
| Live ops | Admin live map + buses-online widget |
| Routes | Optimize stop order → matron sees new sequence |
| Safety | Incident logged + maintenance with expense link |
| Money | Hire-out + expense on ledger → dashboard P&L + budget burn |

**Why it matters vs safety-only trackers:** fee balance, hire-outs, and transport P&L sit next to the same boarding events parents care about.

**Soft-launch ask:** Run one campus week with seed + live scans; freeze new features until demo gate items below stay green.

---

## 10-minute walkthrough (demo gate)

Do these in order. Keep each beat ~60–90s.

### 1. Board 5 students (matron)
1. Open `/matron` → start or select today’s trip.  
2. Scan (or print-sheet QR) **5 students**.  
3. Confirm fee-check note on scan result (Amos).  
**Show:** roster count rising on trip / bus detail.

### 2. Parent message
1. After a time-in scan, open `/admin/messages`.  
2. Point to today’s `message_logs` (SMS or stub).  
**Show:** “Parents notified” without leaving the ops app.

### 3. Live location
1. Keep trip active; matron GPS pings (or wait ~15–30s).  
2. Open `/admin/live` and `/admin/dashboard` buses-online widget.  
**Show:** bus online + last ping age.

### 4. Optimize once
1. Prefer **Majundo Soft-Launch Demo AM** (`seed_majundo_demo_route.sql`) — open from `/admin/routes` or `/admin/live` performance panel.  
2. Run **Optimize & compare** (capacity gate OK; check Force if needed).  
3. Optionally open the route builder / assign a student stop under `/admin/assignments`.  
4. Matron trip view shows updated stop order.  
**Show:** before/after km + time tiles on the map performance panel.

### 5. Incident + maintenance
1. Matron: Report incident on trip.  
2. Admin: `/admin/incidents` filter by severity.  
3. `/admin/maintenance` — log a repair; link/create expense (Irene form).  
**Show:** cost appears under Ledger expenses.

### 6. Hire-out + expense
1. `/admin/hire-outs` — book a wedding/event; leave “create revenue” on.  
2. Point to the **availability calendar** (hired vs free buses for the selected day).  
3. `/admin/ledger` — add a fuel (or other) expense if not already seeded.  
**Show:** booking list + calendar update after refresh.

### 7. P&L + budget vs actual + graphs
1. `/admin/dashboard` — period Revenue / Expense / Net / Budget burn tiles.  
2. Scroll FinancePnL charts: revenue vs expense, budget burn %, category bars, boarding trend.  
3. Optionally change From/To and Apply (`GET /api/finance/pnl`).  
**Show:** real numbers from Kai APIs, not Day-1 sheet placeholders.

---

## Roles for the room

| Person | Station |
|--------|---------|
| Matron demo | Phone Chrome — scan + GPS + incident |
| Admin demo | Laptop — live, routes, ledger, dashboard |
| Docs / Irene | Keep this script; call gate checklist aloud |

---

## Gate checklist (all must be true)

Live walkthrough on seeded prod (or staging with same SQL). Platform prep below is already done.

### Platform ready (2026-07-30)

- [x] `kiki` merged to `main` (`f32c48d`) — `npm run build` clean  
- [x] Prod SQL order applied (`RUN_PROD.sql` / `LOAD_REAL_DATA.md`) + `notify pgrst, 'reload schema'`  
- [x] Roster: schools 5 · students 604 · buses 20 · qr_codes 604 · fee_balances 604  
- [x] Routes: 18 fleet AM + **Majundo Soft-Launch Demo AM** (7 zigzag stops)  
- [x] Finance seed: expenses/revenues/budgets/hire_outs sample rows  
- [x] Incidents table present (`schema_incidents.sql`)  
- [x] Staff profiles: `baraka@` admin · `matron@` matron — Auth passwords provisioned (see `.staff-passwords.local`, gitignored)  
- [x] Host env locally: Supabase URL/anon/service role · `CRON_SECRET` · `NEXT_PUBLIC_APP_URL`  
- [x] Fee sync cron dry-run OK (`GET /api/cron/sync-fees?dryRun=1`)  
- [ ] Vercel prod env mirrored + `vercel --prod` (CLI needs `vercel login` — see `docs/DEPLOY.md`)  
- [ ] Google SSO enabled in Supabase dashboard (`docs/SSO.md`)  
- [ ] Live SMS keys optional (`AFRICASTALKING_*`)

### Soft-launch demo gate (walk on phone + laptop)

Open http://localhost:3000/login — use accounts in `.staff-passwords.local`.
- [ ] 5 students boarded with QR  
- [ ] Parent message visible in Messages  
- [ ] Live location / buses online  
- [ ] Route optimized once  
- [ ] Incident + maintenance (expense linked)  
- [ ] Hire-out booked + expense entered  
- [ ] Dashboard shows P&L + budget vs actual + graphs  
- [ ] Driver app: `/driver` or APK (see [`docs/DRIVER_APP.md`](./docs/DRIVER_APP.md)) — GPS stays live while matron phone is on a call  

**Driver APK:** `npm run mobile:sync && npm run mobile:apk` → install `android/app/build/outputs/apk/debug/app-debug.apk`.

**SQL if empty finance:** `schema_week3.sql` then `seed_finance.sql` after Week 2 schemas.  
**Demo route run order:** `schema_week2` → `seed_silverleaf` → `seed_routes` → `seed_majundo_demo_route.sql`. Fixed id in `src/lib/demo/majundoDemoRoute.ts` (`e2000000-…001`). Does not reassign fleet buses.

**Handover:** [`docs/DEPLOY.md`](./docs/DEPLOY.md) · [`supabase/RUN_PROD.sql`](./supabase/RUN_PROD.sql)

