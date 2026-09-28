# Sprints calendar

8 one-week sprints · 6 tasks each (2 per person) · **48 tasks** · team of 3

Active sprint: **8 complete** — see `docs/CURRENT.md` + `backlog.json → meta.currentSprint`

---

## Phase 1 — Foundation

| Sprint | Name | Focus |
|--------|------|--------|
| 1 | Platform & map | Campuses, warehouses, roles, home desk |
| 2 | Catalogue & stock | SKU+size, main / shop / campus balances |

## Phase 2 — Demand & issue

| Sprint | Name | Focus |
|--------|------|--------|
| 3 | Parent order + FIFO | Order first, then pay; student registration no. |
| 4 | Distribution | Campus requests (admin vs HT) → Imani DN |

## Phase 3 — Money & supply

| Sprint | Name | Focus |
|--------|------|--------|
| 5 | Purchase orders | City buy → **main warehouse first** |
| 6 | Budget & sizes | Cost/revenue/profit; size velocity for next buy |

## Phase 4 — Production & go-live

| Sprint | Name | Focus |
|--------|------|--------|
| 7 | Sewing | Loveness daily jobs → stock |
| 8 | Harden | Printables, import, role smoke, handoff |

---

## Verify each sprint

Password for every desk: **`Silverleaf@2026`**

| Desk | Email | Role |
|------|-------|------|
| Imani (store, distribution & finance) | imani@silverleaf.ac.tz | STORE |
| Loveness (tailor + Usa River shop) | loveness@silverleaf.ac.tz | TAILOR |
| Usa River admin | usa.admin@silverleaf.ac.tz | ADMIN |
| Arusha Town admin | am.admin@silverleaf.ac.tz | ADMIN |
| Kijenge head teacher | kijenge.ht@silverleaf.ac.tz | HEAD_TEACHER |
| Boma head teacher | boma.ht@silverleaf.ac.tz | HEAD_TEACHER |
| Ilboru head teacher | ilboru.ht@silverleaf.ac.tz | HEAD_TEACHER |
| Parent | parent@silverleaf.ac.tz | PARENT |

```bash
npm install
npm run db:setup
npm run dev
node scripts/workbot.mjs status
```
