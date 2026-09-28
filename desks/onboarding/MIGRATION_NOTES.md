# Migration Notes — F1.5 cleanup

## What was removed and why

### Kanban feature (hackathon artefact, out of scope)

The `/kanban` board was added as a hackathon project and is unrelated to staff onboarding. It has been retired cleanly; the full history remains recoverable in git.

| Removed | Reason |
| --- | --- |
| `kanban.json` | Root-level data store for the kanban board |
| `legacy/server/routes/kanban.js` | Express API route (`GET/PUT /api/kanban`) |
| `legacy/client/src/pages/Kanban.jsx` | React page component |
| `legacy/client/src/pages/Kanban.css` | Kanban-specific styles (including dark projector mode) |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` removed from `legacy/client/package.json` | Drag-and-drop library only used by kanban |
| Corresponding entries removed from `legacy/client/package-lock.json` | Lock file kept consistent |

Additionally, `legacy/client/src/App.jsx` had the `import Kanban` statement and `<Route path="/kanban">` removed, and `legacy/server/index.js` had the `import kanbanRoutes` and `app.use('/api/kanban', ...)` mount removed.

### Docker / VPS self-hosted deploy stack (superseded by Vercel)

The app now targets Vercel + Next.js. The self-hosted Docker/Nginx/VPS deploy stack is no longer needed.

| Removed | Reason |
| --- | --- |
| `docker-compose.yml` | Dev-time Docker Compose (started PostgreSQL locally) |
| `deploy/` (whole directory) | All VPS deploy scripts and config: `setup-server.sh`, `upload-to-server.sh`, `docker-compose.prod.yml`, `nginx.example.conf`, `preflight.sh`, `health-check.sh`, `backup-database.sh`, `RUNBOOK.md` |
| `scripts/go-live.sh` | VPS go-live orchestration script |
| `scripts/verify-deployment.sh` | VPS deployment verification (checked Express/Docker stack health) |
| `DEPLOYMENT_CHECKLIST.md` | VPS deployment guide |
| `GO_LIVE_HOSTING_CHECKLIST.md` | Hosting go-live checklist for self-hosted setup |
| `IT_DEPLOY_TASKS.md` | IT tasks for VPS/Docker setup |

### README.md

Updated to reflect the Next.js + Vercel stack, remove Docker/VPS setup instructions, and point to the correct project structure. The legacy app reference under `legacy/` is retained as a note.

## What was kept and why

| Kept | Reason |
| --- | --- |
| `scripts/copy-documents.sh` | Copies onboarding document files from a local folder into `documents/`. Still needed by any developer cloning the repo, regardless of deploy target — documents are never committed to git. |
| `legacy/` (directory) | Full legacy React + Express app retained as reference during migration, per F1.1 plan. |
