# Silverleaf Uniform Tracker — delivery docs

Planning stack for the **complete** uniform operations system across five campuses. Same shape as Shule One: requirements, roadmap, sprints, backlog.

| Document | Purpose |
|----------|---------|
| [GOING-FORWARD.md](./GOING-FORWARD.md) | **Start here** — how we work, stack, ERD, 8-week timeline |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Planning-week report source (Markdown) |
| [Silverleaf-Uniform-Tracker-Planning-Report.docx](./Silverleaf-Uniform-Tracker-Planning-Report.docx) | **Share this** — Word file with diagrams as pictures (WhatsApp / Slack) |
| [Silverleaf-Uniform-Tracker-Planning-Report.pdf](./Silverleaf-Uniform-Tracker-Planning-Report.pdf) | Same report as PDF (WhatsApp can preview pages) |
| [Silverleaf-Uniform-System-User-Guide.pdf](./Silverleaf-Uniform-System-User-Guide.pdf) | **User training guide** — every dashboard, workflows, PO deep dive, manual vs auto |
| [Silverleaf-Uniform-System-User-Guide.docx](./Silverleaf-Uniform-System-User-Guide.docx) | Same user guide as Word (edit/share) |
| [SRS.md](./SRS.md) | What the system must do — mapped to the Excel masters and the 26 Aug 2026 process meeting |
| [ROADMAP.md](./ROADMAP.md) | How three people build it: stack, needs, 8-week timeline |
| [SPRINTS.md](./SPRINTS.md) | Sprint calendar and demo accounts |
| [CURRENT.md](./CURRENT.md) | Active sprint pointer |
| [backlog.json](./backlog.json) | Day-sized tasks (workbot source of truth) |
| [source/](./source/) | Original Excel workbooks + system map + **Excalidraw additions** |

The app is built. After pull:

```bash
node scripts/workbot.mjs status
node scripts/workbot.mjs next
```

## Task sizing

Each backlog item is **~1 focused day** for one developer with AI assist:

- Deliverable code + seed + a smokeable route
- Acceptance criteria in `backlog.json`
- No task spans unrelated modules

## Stack assumptions

- Next.js App Router, Prisma, SQLite → PostgreSQL if several campuses go live together
- Currency: **TZS**
- Demo password for every desk: `Silverleaf@2026`
- Construction team: **Mourine, Geoffrey, Irene** (Nelly joins planning)
