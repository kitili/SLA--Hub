# 🌿 Silverleaf Academy — Management Platform v3.0

Multi-campus school management system for Silverleaf Academy Tanzania (5 campuses). Three independent role-based dashboards sharing a single PostgreSQL database.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   SILVERLEAF PLATFORM                   │
├──────────────┬──────────────────────┬───────────────────┤
│  Marketing   │  Student Experience  │    Dispensary     │
│  Dashboard   │      Dashboard       │    Dashboard      │
├──────────────┴──────────────────────┴───────────────────┤
│         React 18 + Vite + Recharts + Supabase Realtime  │
├─────────────────────────────────────────────────────────┤
│      Node.js + Express, deployed as a Vercel function   │
├─────────────────────────────────────────────────────────┤
│   Supabase (Postgres + Realtime + Storage) + Vercel     │
│                    Cron Jobs (scheduling)               │
└─────────────────────────────────────────────────────────┘
```

Deployed to **Vercel** (frontend as a static build, backend as a serverless function) with **Supabase** providing the database, real-time broadcast (replacing Socket.IO), and file storage (replacing local-disk uploads). Scheduled jobs (previously `node-cron`) run as Vercel Cron Jobs hitting dedicated `/api/cron/*` routes — see `vercel.json`.

The `devops/` Docker Compose setup is legacy from before this migration — it depended on Socket.IO, `node-cron`, and local-disk uploads, all of which this codebase no longer uses, so that path is no longer maintained. Vercel + Supabase is the supported deployment target.

**External integrations:**
- Email: Nodemailer (SMTP)
- SMS / WhatsApp: Africa's Talking
- Social analytics: Buffer.com GraphQL (`BUFFER_API_KEY`)
- Ed Admin: webhook handoff on enrolment confirmed

---

## Campuses

| Code | Campus              |
|------|---------------------|
| ACC  | Arusha City Campus  |
| USR  | Usa River Campus    |
| BOM  | Boma                |
| KJG  | Kijenge             |
| ILB  | Ilboru              |

---

## Roles

| Role | Access |
|------|--------|
| `global_marketing_head`   | All campuses, user management, campaigns |
| `campus_marketing_head`   | Own campus only |
| `global_student_exp_head` | All campuses, approves drug quotations |
| `campus_student_exp_head` | Own campus only |
| `nurse`                   | Dispensary (own campus) |

**Domain restriction:** All accounts must use `@silverleaf.co.tz` email.  
**Default password:** set via `DEFAULT_PASSWORD` in `backend/.env` (never commit the real value) — users are forced to change on first login.

---

## Lead Funnel (auto-computed)

The system automatically classifies each lead's stage based on milestone records — **never manually set**:

```
Interested Lead → Tour Booked → Interview → Register (Form Filled) → Enrolled → Admission Paid
       ↓                                        ↑
   Dead Lead                            Ed Admin confirms enrolment
(90+ days dormant,
   auto via cron)
```

- **Dead Lead** — an Interested Lead that stays dormant 90+ days despite follow-up interventions is automatically moved here by a nightly cron job.
- **Interview** — after the campus tour, staff book an interview date/time (parent is notified). Once conducted, staff grade it **passed** (green) or **failed** (red) — the parent is notified of the result either way. A failed interview does not end the funnel; staff can rebook.
- **Register (Form Filled)** — passing the interview automatically sends the parent the official Ed Admin online application link (`https://silverleafacademy.ed-space.net/onlineapplication.cfm?ref=<lead_id>`). When the parent completes it there, Ed Admin's `application-submitted` webhook moves the lead here.
- **Enrolled** — Ed Admin owns enrolment from here; its `enrolment-confirmed` webhook (or the manual "Mark as Enrolled" fallback) advances the lead and the parent is asked to send their payment receipt.
- **Admission Paid** — set either by Ed Admin's `payment-confirmed` webhook (its finance module marking the parent as paid) or by staff manually recording the payment in the app — whichever happens first wins, the other call is a no-op.

Stages `declined` and `lapsed` can be set manually by marketing staff.

---

## Project Structure

```
silverleaf-v3/
├── sql/
│   └── 001_migration.sql       ← Full schema, triggers, seed data
├── backend/
│   ├── app.js                  ← Express app (routes, middleware) — no listen(), used by both entry points below
│   ├── server.js               ← Local dev entry point (wraps app.js, npm run dev)
│   ├── api/
│   │   ├── index.js            ← Vercel entry point (wraps app.js as a serverless function)
│   │   └── cron/               ← Vercel Cron targets (stale-leads, dead-leads, drug-expiry, form-reminders)
│   ├── lib/
│   │   ├── realtime.js         ← Supabase Realtime broadcast helper (replaces Socket.IO)
│   │   └── storage.js          ← Supabase Storage upload/signed-URL helper (replaces local uploads)
│   ├── db.js                   ← PostgreSQL connection pool
│   ├── seed.js                 ← Seed default accounts
│   ├── middleware/
│   │   ├── auth.js             ← JWT, domain enforcement, auth routes
│   │   └── notifications.js    ← Email, SMS, WhatsApp helpers
│   └── routes/
│       ├── admin.js            ← Campuses, users, reports engine
│       ├── marketing.js        ← Leads, tours, campaigns, social, events
│       ├── studentExperience.js← Incidents, walkthroughs, behaviour, events
│       └── dispensary.js       ← Visits, inventory, referrals, quotations
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx             ← Router + role guards
        ├── main.jsx
        ├── index.css
        ├── store/authStore.js  ← Zustand persisted auth
        ├── utils/api.js        ← Axios with 401 redirect
        ├── utils/supabaseClient.js ← Browser Supabase client (Realtime only)
        ├── hooks/useSocket.js  ← Real-time hook (Supabase Realtime, same external interface as before)
        ├── components/shared/
        │   ├── Layout.jsx      ← Sidebar layout (module-aware)
        │   ├── UI.jsx          ← KpiCard, Badge, Modal, Table, etc.
        │   └── ProfileBase.jsx ← Change email / password
        └── pages/
            ├── Login.jsx
            ├── shared/ChangePassword.jsx
            ├── marketing/     ← Dashboard, Leads (Kanban), Campaigns,
            │                    Analytics, Calendar, Team, Reports
            ├── se/            ← Dashboard, Incidents, Walkthroughs,
            │                    Behaviour, EventReports, DispensaryView,
            │                    Calendar, Team, Reports
            └── dispensary/    ← Dashboard, Visits, Inventory,
                                 Referrals, Quotations, Reports
```

---

## Quick Start — Local Development

Local development uses the same Supabase project as production would (or your own separate dev project) — the backend requires `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to even start (real-time broadcast and file storage both depend on it, not just the database), so there's no local-Postgres-only mode anymore.

### Prerequisites
- Node.js ≥ 18
- npm
- A Supabase project ([supabase.com](https://supabase.com) — free tier is fine for development)

### 1. Clone and install

```bash
git clone https://github.com/your-org/silverleaf-v3.git
cd silverleaf-v3

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Set up the database

Run the migrations against your Supabase project, in order, via the SQL Editor in the Supabase dashboard, or `psql` against its connection string:

```bash
psql "<your Supabase connection string>" -f sql/001_migration.sql
psql "<your Supabase connection string>" -f sql/002_lead_form_reminders.sql
psql "<your Supabase connection string>" -f sql/003_admission_form_document.sql
psql "<your Supabase connection string>" -f sql/004_enrolment_tracking.sql
psql "<your Supabase connection string>" -f sql/005_fix_enrolled_stage_view.sql
psql "<your Supabase connection string>" -f sql/006_interview_and_dead_lead.sql
```

Then create two **private** Storage buckets in the Supabase dashboard: `admission-forms` and `walkthrough-photos`.

### 3. Configure environment

```bash
# Backend (server.js loads its .env from the backend/ working directory)
cp backend/.env.example backend/.env
# Edit backend/.env — DATABASE_URL (Supabase pooler string, port 6543), SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, DEFAULT_PASSWORD, SMTP/AT credentials, CRON_SECRET

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env — VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### 4. Seed default accounts

```bash
cd backend
node seed.js
```

This creates accounts for all roles across all campuses, using whatever `DEFAULT_PASSWORD` you set in `backend/.env`.

### 5. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:3000 and log in with `marketing@silverleaf.co.tz` and the `DEFAULT_PASSWORD` you configured.

---

## Production Deployment (Vercel + Supabase)

### 1. Create the Supabase project

- Create a project at [supabase.com](https://supabase.com).
- Run the migrations against it, in order: `sql/001_migration.sql` through `sql/006_interview_and_dead_lead.sql` (Supabase dashboard → SQL Editor, or `psql` against the connection string).
- Create two **private** Storage buckets: `admission-forms` and `walkthrough-photos`.
- Note down, from Project Settings → API and → Database:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (API)
  - The **transaction-mode pooler** connection string, port 6543 (Database → Connection pooling) — this becomes `DATABASE_URL`. Use the pooler, not the direct connection; serverless functions open many short-lived connections and only the pooler absorbs that safely.
  - The anon/public key (API) — becomes `VITE_SUPABASE_ANON_KEY` for the frontend.

### 2. Deploy two Vercel projects from this repo

- **Backend** — root directory `backend/`. Vercel auto-detects `api/*.js` as serverless functions and reads `vercel.json` for cron schedules and routing rewrites.
- **Frontend** — root directory `frontend/`. Zero-config static Vite build.

### 3. Environment variables

Backend project: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any random string), `JWT_SECRET`, `JWT_EXPIRES`, `DEFAULT_PASSWORD`, `SMTP_*`, `AT_*`, `FRONTEND_URL` (the deployed frontend's URL, for CORS), `NODE_ENV=production`.

Frontend project: `VITE_API_URL` (the deployed backend's URL + `/api`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

See `backend/.env.example` and `frontend/.env.example` for the full list with descriptions.

### 4. Seed default accounts

Run `node seed.js` once, locally, pointed at the Supabase `DATABASE_URL` (via a temporary local `.env`) — there's no shell access on Vercel to run it there directly.

---

## Production Deployment (Docker — legacy, unmaintained)

This path predates the Vercel + Supabase migration above and depended on Socket.IO, `node-cron`, and local-disk uploads — none of which this codebase uses anymore. Kept for reference only; would need rework (re-adding an in-process scheduler, local file storage) to run correctly again.

### Prerequisites on server
- Docker + Docker Compose v2
- Domain pointing to server IP
- Ports 80 and 443 open

### Deploy

```bash
# On your server
mkdir -p /opt/silverleaf
cd /opt/silverleaf

# Copy files
git clone https://github.com/your-org/silverleaf-v3.git .

# Configure production env
cp .env.example .env
nano .env   # Fill in all values

# Start services (first run — migrates DB automatically via docker-entrypoint)
cd devops
docker compose up -d

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
```

### SSL Setup (Let's Encrypt)

```bash
cd /opt/silverleaf/devops

# Initial certificate (run once)
docker compose --profile ssl up certbot

# Auto-renewal via cron (add to crontab)
0 3 * * * docker compose exec certbot certbot renew --quiet && docker compose exec frontend nginx -s reload
```

### Automated Backups

```bash
# Make backup script executable
chmod +x /opt/silverleaf/devops/backup.sh

# Add to crontab (runs at 2am daily)
crontab -e
# Add: 0 2 * * * /opt/silverleaf/devops/backup.sh >> /var/log/silverleaf-backup.log 2>&1
```

---

## CI/CD (GitHub Actions)

The `.github/workflows/deploy.yml` workflow:
1. Lints code on every push and PR
2. Builds Docker images and pushes to GitHub Container Registry (on `main`)
3. SSHs into production server and does a rolling restart
4. Triggers a database backup after each deploy

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `SERVER_HOST`     | Production server IP/hostname |
| `SERVER_USER`     | SSH username |
| `SERVER_SSH_KEY`  | SSH private key |
| `DATABASE_URL`    | PostgreSQL connection string |
| `JWT_SECRET`      | 64+ character random string |
| `DEFAULT_PASSWORD`| Temporary password for new/reset accounts (pick your own, never reuse the repo's placeholder) |
| `SMTP_HOST`       | SMTP server |
| `SMTP_USER`       | SMTP username |
| `SMTP_PASS`       | SMTP password |
| `AT_API_KEY`      | Africa's Talking API key |
| `AT_USERNAME`     | Africa's Talking username |
| `FRONTEND_URL`    | https://silverleaf.co.tz |
| `API_URL`         | https://api.silverleaf.co.tz |
| `VITE_API_URL`    | https://api.silverleaf.co.tz/api |
| `VITE_WS_URL`     | https://api.silverleaf.co.tz |

---

## Key API Routes

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Log in |
| PATCH | `/api/auth/change-password` | Change own password |
| PATCH | `/api/auth/change-email` | Change own email |
| PATCH | `/api/auth/reset-password/:id` | Admin: reset to default |

### Admin
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/admin/campuses` | All authenticated |
| POST | `/api/admin/campuses` | Global heads |
| GET | `/api/admin/users` | Global heads |
| POST | `/api/admin/users` | Global heads |
| GET | `/api/admin/reports?module=marketing&period=monthly` | All |

### Marketing
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/marketing/dashboard` | Dashboard data |
| GET | `/api/marketing/leads` | Leads with filters |
| POST | `/api/apply` | **Public** — parent online form (UTM + campaign slug) |
| GET | `/api/public/campuses` | **Public** — active campuses for the apply form |
| GET | `/api/public/calendar` | **Public** — marketing enrolment / open-day JSON |
| GET | `/api/public/calendar.ics` | **Public** — same feed as an ICS subscription |
| POST | `/api/marketing/leads` | Staff-created lead |
| GET | `/api/marketing/campaigns` | All campaigns |
| POST | `/api/marketing/social/buffer/sync` | Pull Silverleaf channels from Buffer.com |

Public website pages (Next.js `web/`): `/apply` replaces the Google Form; `/calendar` and `/calendar/embed` are the parent-facing school-year dates. Wix can iframe `/calendar/embed` or subscribe to `/api/public/calendar.ics`.

### Student Experience
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/marketing/leads/:id/interviews` | Book (or rebook) an admission interview |
| PATCH | `/api/marketing/interviews/:id/outcome` | Grade the interview — `passed` or `failed` |
| GET | `/api/se/dashboard` | Dashboard |
| POST | `/api/se/incidents` | Log incident (SMS parents if high/critical) |
| POST | `/api/se/walkthroughs` | New safety walkthrough |
| PATCH | `/api/se/dispensary/quotations/:id/status` | Approve/reject quotation (global SE only) |

### Dispensary
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/dispensary/dashboard` | Dashboard |
| POST | `/api/dispensary/visits` | New visit (emergency chain fires automatically) |
| POST | `/api/dispensary/quotations` | Submit quotation (emails SE heads) |

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/buffer` | Optional inbound Buffer snapshot (`/puffer` alias) |
| POST | `/api/webhooks/edadmin/application-submitted` | Parent completed the online admission application — moves lead to `form_filled` (Register) |
| POST | `/api/webhooks/edadmin/enrolment-confirmed` | Ed Admin enrolment handoff — moves lead to `enrolled` |
| POST | `/api/webhooks/edadmin/payment-confirmed` | Ed Admin finance confirms payment received — moves lead to `admission_paid` |

---

## Real-time Events (Supabase Realtime)

Broadcast via `backend/lib/realtime.js`, received in the frontend via `useSocket()` (`frontend/src/hooks/useSocket.js`), which subscribes to Supabase Realtime channels named the same as the old Socket.IO rooms (`campus-${id}` / `global`):

| Event | Direction | Trigger |
|-------|-----------|---------|
| `incident-alert` | Server → client | High/critical incident logged |
| `dispensary-emergency` | Server → client | Emergency visit recorded |
| `low-stock-alert` | Server → client | Drug stock drops below minimum |
| `critical-walkthrough` | Server → client | Critical safety finding logged |
| `behaviour-escalation` | Server → client | Escalated behaviour report |
| `social-updated` | Server → client | Buffer sync or inbound webhook |
| `admission_paid` | Server → client | Lead reaches admission paid stage |

---

## Scheduled Jobs (Vercel Cron)

Configured in `backend/vercel.json`; each hits a protected `/api/cron/*` route (checks `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically):

| Schedule | Route | Job |
|----------|-------|-----|
| `0 7 * * *` | `/api/cron/stale-leads` | Create follow-up tasks for stale leads (>7 days no movement) |
| `0 7 * * *` | `/api/cron/dead-leads` | Mark Interested Leads dormant 90+ days as Dead Lead |
| `0 6 * * *` | `/api/cron/drug-expiry` | Check drug expiry — alert nurses for items ≤30 days |
| `0 8 * * *` | `/api/cron/form-reminders` | Admission-form reminder sequence (day 3 / day 7) |
| `0 5 * * *` | `/api/cron/edadmin-sync` | Pull Ed Admin parents and students |
| `15 6 * * *` | `/api/cron/buffer-sync` | Pull Silverleaf Buffer.com channel metrics |

---

## Ed Admin Integration Boundary

Silverleaf owns the funnel through **Interview**. From **Register** onward, Ed Admin owns the process — the online admission application, enrolment, and payment all happen on Ed Admin's side, and its webhooks report progress back into this system:

| Ed Admin webhook | Moves lead to |
|---|---|
| `POST /api/webhooks/edadmin/application-submitted` | `form_filled` (Register) |
| `POST /api/webhooks/edadmin/enrolment-confirmed` | `enrolled` |
| `POST /api/webhooks/edadmin/payment-confirmed` | `admission_paid` |

Each webhook is idempotent (safe to call more than once) and coexists with the equivalent manual staff action (Mark as Enrolled, Record Payment) as a fallback — whichever happens first wins.

Fields reserved for Ed Admin reconciliation:
- `admission_applications.edadmin_ref`
- `admission_payments.edadmin_ref`

---

## Support

For issues contact: **admin@silverleaf.co.tz**
