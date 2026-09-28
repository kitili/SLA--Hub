# Roles & Permissions Matrix

Source of truth for who can see/do what in Majundo Ops. Roles are defined in
`src/lib/roles.ts`. Update this file whenever a route's access rules change —
code should match this doc, not the other way around.

## Roles

| Role      | Who                          | Default home       |
| --------- | ----------------------------- | ------------------- |
| `admin`   | Ops/school admin staff        | `/admin/dashboard`  |
| `finance` | Finance/fees staff            | `/admin/dashboard`  |
| `matron`  | Bus matron (scans students)   | `/matron`            |
| `driver`  | Bus driver                    | `/matron`            |

Provision accounts: [`STAFF_USERS.md`](./STAFF_USERS.md). Google SSO: [`SSO.md`](./SSO.md).

## Pages

| Area                          | admin | finance | matron | driver | Enforced today? |
| ------------------------------ | :---: | :-----: | :----: | :----: | ---------------- |
| `/admin/*`                     |  ✅   |   ✅    |  ❌    |  ❌    | Yes — `admin/layout.tsx` + `proxy.ts` |
| `/matron/*`                    |  ❌   |   ❌    |  ✅    |  ✅    | Yes — `(matron)/layout.tsx` + `proxy.ts` |
| `/login`, `/auth/callback`     |  —    |   —     |   —    |   —    | Public (callback exchanges OAuth code) |

## API routes

All `/api/**` handlers use `requireUser([...])` unless noted. Cron uses Bearer `CRON_SECRET`.

| Route | admin | finance | matron | driver | Auth |
|-------|:-----:|:-------:|:------:|:------:|------|
| `GET/POST /api/students` | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| `GET /api/buses` | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| `GET/POST /api/trips` | ✅ | ✅ | ✅ | ✅¹ | `requireUser` (POST: no finance) |
| `GET /api/trips/live` | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| `POST/GET /api/trips/:id/locations` | ✅ | ✅² | ✅ | ✅ | `requireUser` |
| `POST /api/trips/:id/depart` | ✅ | ❌ | ✅ | ✅ | `requireUser` |
| `GET /api/trips/:id/stops` | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| `POST /api/boarding` | ✅ | ❌ | ✅ | ✅ | `requireUser` |
| `GET/POST /api/qr/resolve` | ✅ | ✅ | ✅ | ✅ | `requireUser` |
| `POST /api/qr/generate` | ✅ | ❌ | ❌ | ❌ | `requireUser(["admin"])` |
| `GET/POST /api/routes` | ✅ | ✅³ | ✅³ | ✅³ | POST admin-only |
| `GET/PATCH /api/routes/:id` | ✅ | ✅³ | ✅³ | ✅³ | PATCH admin-only |
| `PUT /api/routes/:id/stops` | ✅ | ❌ | ❌ | ❌ | admin |
| `POST /api/routes/:id/optimize` | ✅ | ❌ | ❌ | ❌ | admin |
| `GET/POST /api/stops` | ✅ | ✅³ | ✅³ | ✅³ | POST admin-only |
| `PATCH /api/stops/:id` | ✅ | ❌ | ❌ | ❌ | admin |
| `GET/POST /api/student-stops` | ✅ | ✅³ | ✅³ | ✅³ | POST admin-only |
| `GET/POST /api/incidents` | ✅ | ✅⁴ | ✅ | ✅ | POST: no finance |
| `GET/POST /api/maintenance` | ✅ | ✅ | ✅⁴ | ✅⁴ | POST: admin/finance |
| `GET/POST /api/expenses` | ✅ | ✅ | ✅⁴ | ❌ | POST: admin/finance |
| `GET/POST /api/revenues` | ✅ | ✅ | ✅⁴ | ❌ | POST: admin/finance |
| `GET/POST/PATCH /api/hire-outs` | ✅ | ✅ | ✅⁴ | ✅⁴ | writes: admin/finance |
| `GET/POST /api/budgets` | ✅ | ✅ | ❌ | ❌ | admin/finance |
| `GET /api/finance/pnl` | ✅ | ✅ | ❌ | ❌ | admin/finance |
| `GET/POST /api/messages` | ✅ | ✅ | ✅ | ❌ | `requireUser` |
| `POST /api/admin/cluster-stops` | ✅ | ❌ | ❌ | ❌ | admin (dry-run default) |
| `/api/cron/sync-fees` | n/a | n/a | n/a | n/a | Bearer `CRON_SECRET` |

¹ POST trips: admin, matron, driver.  
² GET locations includes finance; POST does not.  
³ Read-only for non-admin.  
⁴ GET only where marked.

## Intentionally open

- **None** for business APIs.
- Public: `/`, `/login`, `/auth/callback` (session exchange only).
- Cron: shared secret, not role-based.

## Page + proxy gates

- `admin/layout.tsx` → redirect unless `admin` or `finance`.
- `(matron)/layout.tsx` → redirect unless `matron` or `driver`.
- `proxy.ts` mirrors the same path prefixes for defense in depth.
