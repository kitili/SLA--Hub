# Silverleaf Tasks

Next.js backend + admin dashboard for staff **Daily 5** task tracking over WhatsApp, with PostgreSQL, Redis queues, full chat history, backlog, projects, and activity audit logs.

## Features

- **WhatsApp bot commands** — daily 5 submission, done/start/block updates, backlog, project updates
- **PostgreSQL database** — users, tasks, daily plans, projects, chat messages, webhook idempotency
- **Redis + BullMQ** — async webhook processing for high volume (10k+ users)
- **Admin dashboard** — tasks, projects, chat history, live stats
- **REST API** — programmatic access for integrations

## Quick start

### 1. Start infrastructure

```bash
docker compose up -d
cp .env.example .env
```

### 2. Install and migrate

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 3. Run app + worker

Terminal 1:

```bash
npm run dev
```

Terminal 2 (production / scale):

```bash
npm run worker
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## WhatsApp setup (Meta Cloud API)

1. Create a Meta Business app with WhatsApp product
2. Add a phone number and get **Phone Number ID** + **Permanent Access Token**
3. Set webhook URL: `https://YOUR_DOMAIN/api/webhooks/whatsapp`
4. Verify token: match `WHATSAPP_VERIFY_TOKEN` in `.env`
5. Subscribe to `messages` field

### Staff commands

| Command | Example |
|---------|---------|
| Submit daily 5 | `daily Report \| Calls \| Invoices \| Sync \| Email` |
| Mark done | `done 1 3 5` |
| In progress | `start 2` |
| Blocked | `block 3 — waiting on finance` |
| Status | `status` |
| Add backlog | `backlog add: Fix server migration` |
| List backlog | `backlog` |
| Project update | `update Operations: deploy staging completed` |
| Help | `help` |

## Architecture (scale)

```
WhatsApp → Webhook (Next.js) → Redis Queue → Worker → PostgreSQL
                                      ↓
                              Auto-reply via Cloud API
```

- Webhook returns `200` immediately (Meta requirement)
- `WebhookEvent` table deduplicates by `waMessageId`
- Worker concurrency configurable (default 50)
- Indexed queries on phone, org, status, dates

## API

Optional header: `x-api-secret: YOUR_API_SECRET`

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/users`
- `GET /api/messages`
- `GET /api/dashboard/stats`

## Production notes

- Deploy Next.js (Vercel/Railway/Fly) + managed Postgres + Redis
- Run `npm run worker` as a separate process
- Use connection pooling (PgBouncer) for 10k concurrent users
- Set strong `API_SECRET` and rotate `WHATSAPP_TOKEN`
- Enable daily digest cron (extend worker with scheduled jobs)

## Environment

See `.env.example` for all variables.
