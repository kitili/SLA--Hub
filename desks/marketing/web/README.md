# Silverleaf Web (Next.js)

Marketing-first Next.js App Router UI. Express API stays in `../backend` and is proxied via `/api`.

## Local

```bash
# Terminal 1 — API
cd ../backend && PORT=5001 npm run dev

# Terminal 2 — Next
cd ../web && npm run dev
```

Open http://127.0.0.1:3180

Login: `marketing@silverleaf.co.tz` / `Marketing@2026` (pinned).

## Smoke

```bash
# API only
cd ../backend && npm run test:marketing

# API + Next proxy + page routes
cd ../backend && npm run test:stack
# or from web/
cd ../web && npm run test:smoke
```
