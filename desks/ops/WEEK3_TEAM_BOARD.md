# Majundo Ops — Week 3 Team Board (Days 13–15)

**Team:** Kai · Amos · Jfree · Irene  
**Week goal:** Finance ledger (expenses / revenues / hire-outs / budgets), period P&L + budget vs actual, harden fee sync, soft-launch demo.

**Prior weeks:**  
- **Week 1** ✅ — see [`WEEK1_TEAM_BOARD.md`](./WEEK1_TEAM_BOARD.md)  
- **Week 2** ✅ Kai + Amos submitted — see [`WEEK2_TEAM_BOARD.md`](./WEEK2_TEAM_BOARD.md)

**Week 3 status (submitted):**  
- **Kai** ✅ Complete (finance CRUD APIs, `GET /api/finance/pnl`, fee-sync harden + `seed_finance.sql`)  
- **Amos** ✅ Complete (fee consistency on scan, matron QA polish, print QR sheets)  
- **Jfree / Irene** ⬜ Hire-out calendar, map/performance panel, ledger UI, charts, demo script still open

**Board hygiene:** After every PR, update Status to match what shipped.

**Week 3 status (Irene + Jfree UI landed — Kai/Amos/Irene/Jfree ✅; team bug bash still ⬜):**  
- **Kai** ✅ Complete (finance CRUD + P&L APIs, fee-sync harden, `seed_finance`, bus crew/capacity seed fixes)  
- **Amos** ✅ Complete (fee-check on scan, matron QA polish, QR print sheets)  
- **Irene** ✅ Complete (ledger + hire-out booking UI, PnL charts/KPI tiles, `DEMO.md`)  
- **Jfree** ✅ Complete (hire-out calendar, map/route performance panel, Majundo demo route seed; also fixed `saveOptimizedRouteOrder` bug)

**Board hygiene:** After every PR, update Status to match what shipped (code paths, not commit messages alone).

---

## Who owns what (fixed)

| Person | Owns |
|--------|------|
| **Kai** | Finance schema/APIs, P&L aggregations, fee-sync hardening |
| **Amos** | Fee consistency on scan, matron QA polish, QR print sheets |
| **Jfree** | Hire-out calendar, map/route performance panel, demo route |
| **Irene** | Ledger UI, charts, KPI tiles, demo script |

---

## Day 13 — Finance ledger

**Done when:** Expenses/revenues/hire-outs/budgets APIs exist; scan shows fee consistency; hire-out calendar + booking UI work.  
**Status:** Kai + Amos + Irene + Jfree ✅.

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | APIs: `expenses`, `revenues`, `hire_outs`, `budgets` | Captain | ✅ Done (`/api/expenses`, `/api/revenues`, `/api/hire-outs`, `/api/budgets` + `schema_week3.sql`) |
| **Amos** | Fee balance consistency check on scan | Integrator | ✅ Done (`fee-check.ts` + `ScanResultCard`) |
| **Jfree** | Hire-out availability calendar | QA Hawk | ✅ Done (`HireOutCalendar` on `/admin/hire-outs`) |
| **Irene** | Expense/revenue + hire-out booking UI | Docs Scout | ✅ Done (`/admin/ledger`, `/admin/hire-outs` + AdminShell nav) |

---

## Day 14 — P&L + budget vs actual

**Done when:** Period P&L API returns budget vs actual; matron QA polish landed; map performance panel + charts/KPI tiles live.  
**Status:** Kai + Amos + Irene + Jfree ✅.

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | Period P&L aggregation API | Integrator | ✅ Done (`GET /api/finance/pnl`) |
| **Amos** | Matron walkthrough QA fixes | Captain | ✅ Done (home/scanner/list polish) |
| **Jfree** | Map + route performance panel | Docs Scout | ✅ Done (`RoutePerformancePanel` on `/admin/routes` + `/admin/live`; fixed `saveOptimizedRouteOrder` bug) |
| **Irene** | Charts + KPI tiles | QA Hawk | ✅ Done (`FinancePnLPanel` on `/admin/dashboard` wired to `/api/finance/pnl`) |

---

## Day 15 — Hardening & final demo

**Done when:** Fee sync is prod-ready with seed backup; QR sheets printable; demo route + script ready; bug bash frozen.  
**Status:** Kai + Amos + Irene + Jfree ✅ · team bug bash / full demo gate ⬜ (platform SQL + merge ready 2026-07-30 — walk `DEMO.md` gate on phone/laptop).

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **All** | Bug bash; freeze features | — | ⬜ |
| **Kai** | Fee sync prod-ready + backup seed | Docs Scout | ✅ Done (dryRun, overlap lock, `seed_finance.sql`; also bus `driver_name`/`attendant_name`/`owner_name` + capacity/plate + maintenance `budget_amount`) |
| **Amos** | Print QR sheets for demo | QA Hawk | ✅ Done (`/matron/students/print` + `PrintQrSheets`) |
| **Jfree** | Sample optimized Majundo demo route | Captain | ✅ Done (`supabase/seed_majundo_demo_route.sql` + `majundoDemoRoute.ts`; linked from `/admin/routes` + `DEMO.md`) |
| **Irene** | Demo script + one-pager | Integrator | ✅ Done (`DEMO.md` — soft-launch walkthrough + gate checklist) |

**Demo gate:** Board 5 students · parent message · live location · optimize · incident+maintenance · hire-out+expense · P&L + budget vs actual.  
**(Kai APIs + Amos matron + Irene finance UI/demo script + Jfree calendar/map panel/demo route ready; team bug bash still open.)**

---

## Checklist

- [x] Day 13 — finance CRUD APIs (Kai ✅ · Amos fee-check ✅ · Irene ledger/hire-outs ✅ · Jfree calendar ✅)
- [x] Day 14 — P&L aggregation (Kai ✅ · Amos matron QA ✅ · Irene charts/KPIs ✅ · Jfree panel ✅)
- [x] Day 15 — harden cron + finance seed (Kai ✅ · Amos print QR ✅ · Irene `DEMO.md` ✅ · Jfree demo route ✅ · team gate ⬜)

**Submitted — Kai Week 3 APIs:** ✅ complete.  
**Submitted — Amos Week 3 matron:** ✅ fee check · QA polish · print QR sheets.  
**Submitted — Irene Week 3:** ✅ ledger UI · hire-out booking · PnL charts/KPI tiles · `DEMO.md`.  
**Submitted — Jfree Week 3:** ✅ hire-out calendar · map/route performance · Majundo demo route seed.  
**Remaining:** All (bug bash / demo gate).

**SQL (Kai):** `supabase/schema_week3.sql` then `supabase/seed_finance.sql` after Week 2 schemas.  
**SQL (Jfree demo route):** `supabase/seed_majundo_demo_route.sql` after `seed_silverleaf.sql` + `seed_routes.sql`.
