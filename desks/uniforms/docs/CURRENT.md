# Current sprint

| Field | Value |
|-------|--------|
| **Phase** | 4 — Production & go-live |
| **Sprint** | 8 — Harden (complete) |
| **Goal** | Full system: map, stock, FIFO, distribution, POs, sewing, analytics, printables |
| **Started** | 2026-08-26 |
| **Finished** | 2026-08-30 |

## Active task

All 48 backlog tasks are **done**. `node scripts/workbot.mjs status` should report no open items.

## Sprint 1 checklist

- [x] TASK-001 — Prisma schema: campuses, warehouses, users, roles
- [x] TASK-002 — Session auth + role nav matching the system map
- [x] TASK-003 — Seed five campuses, two warehouses, named desks
- [x] TASK-004 — Home desk that mirrors Tailoring → Inventory → Distribution → Campuses
- [x] TASK-005 — Finance and campus views as separate landings
- [x] TASK-006 — README + `npm run db:setup` smoke

## Sprint 8 checklist

- [x] TASK-043 — Print coupon
- [x] TASK-044 — Print delivery note
- [x] TASK-045 — Excel import snapshot documented
- [x] TASK-046 — Role smoke script
- [x] TASK-047 — Backup / Postgres note
- [x] TASK-048 — CURRENT.md complete + handoff walkthrough in README

## Definition of done (every task)

1. Acceptance criteria in `backlog.json` met
2. Seed updated if demo data needed
3. Task marked `done` in backlog + this file checkbox ticked
