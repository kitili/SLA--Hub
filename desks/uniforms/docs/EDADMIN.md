# Ed-admin integration (parent portal)

The parent portal links to Silverleaf’s **Ed-admin** parent–student directory via GET APIs. When configured, parents log in with a child’s **AdmNo** (registration number); the app pulls roster data from Ed-admin and groups siblings by **ParentID**.

## Setup

1. Copy env vars into `.env` (or `.env.local`):

```bash
EDADMIN_BASE_URL="https://silverleafacademy.ed-space.net"
EDADMIN_GENERAL_API_KEY="your-key-from-ed-admin"
EDADMIN_CAMPUS="Silverleaf"
```

2. **Postman** — import [`docs/postman/edadmin-general-api.postman_collection.json`](./postman/edadmin-general-api.postman_collection.json), set `apiKey`, run **Parents** and **Students** to verify.

3. **Probe script**:

```bash
node scripts/probe-edadmin.mjs
```

4. Apply schema + sync:

```bash
npm run db:push
curl -X POST http://localhost:3000/api/admin/edadmin-sync -b "slu_session=…"
```

Or log in as a parent with a real AdmNo — the app syncs that family on first login.

## How it works

| Step | What happens |
|------|----------------|
| Parent login | `loginOrCreateByReg(regNo)` looks up local DB; on miss, calls Ed-admin and upserts student + siblings via `ParentID` |
| Family link | `Family.edadminParentId` = Ed-admin parent `<ID>`; all children with same `ParentID` share one family |
| Staff sync | `POST /api/admin/edadmin-sync` (STORE / FINANCE / CEO) — full directory pull |
| Cache | In-memory 5-minute cache of Parents + Students lists |

## API endpoints (Ed-admin General)

| GET | Purpose |
|-----|---------|
| `/api/general/v1/Parents` | Guardian names, phones, emails |
| `/api/general/v1/Students` | Roster; `AdmNo` → `Student.regNo`, `ParentID` → family |
| `/api/general/v1/StudentClasses` | Grade/class labels |

Auth: `Authorization: Bearer {EDADMIN_GENERAL_API_KEY}`

## Local schema fields

- `Student.edadminId` — Ed-admin student `<ID>`
- `Family.edadminParentId` — Ed-admin parent `<ID>`

Without Ed-admin env vars, the app falls back to seeded SQLite students only (demo mode).
