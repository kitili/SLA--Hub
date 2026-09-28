# Driver app — field go-live

**Status: Ready for soft-launch** (sideload APK / PWA)  
**Live:** https://ops-transport-system.vercel.app  
**Install:** https://ops-transport-system.vercel.app/get-driver  
**Full handover:** [`DRIVER_APP_HANDOVER.md`](./DRIVER_APP_HANDOVER.md) · **v2:** [`DRIVER_APP_V2.md`](./DRIVER_APP_V2.md)

---

## What is live now

| Piece | Status |
|-------|--------|
| Web `/driver` (Home · Path · Account) | Live on Vercel |
| APK download | Live (`/downloads/sl-driver.apk`) |
| GPS outbox + trip APIs | Live |
| v2 Path (Maps, Arrived, live ETA, delay report) | Live |
| Bus ownership for linked drivers | Live |
| Admin → Drivers → Link login | Live |
| `profiles.driver_id` column | **Present in prod** |
| Street Path ORS cache table | **Run SQL below if missing** |
| Driver Auth user | Provision with script (see below) |

---

## Google Maps (required for in-app trip map)

Add to Vercel (Production + Preview) and `.env.local`:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Maps JavaScript API (browser)
- `GOOGLE_MAPS_API_KEY` — Directions API (server; can be the same key with fewer HTTP referrer limits)

Enable **Maps JavaScript API** and **Directions API** on the Google Cloud key.

Without the browser key, Trip still works: drivers see a clear prompt and can tap **Navigate** to open Google Maps.

Optional geometry cache table (admin maps): run [`supabase/APPLY_DRIVER_GO_LIVE.sql`](../supabase/APPLY_DRIVER_GO_LIVE.sql).

---

## Create driver logins (100+ scale)

Do **not** share `driver@silverleaf.co.tz` for real fleets. Each driver gets their own Auth login + portfolio.

### Admin UI (preferred)

1. Import / add fleet drivers in **Admin → Drivers**
2. Open **Bulk provision Driver app logins**
3. Review suggested emails (`firstname.lastname@silverleaf.co.tz`)
4. **Provision selected** or **Provision all unlinked**
5. **Download CSV** of temporary passwords immediately and hand them out

Per-row: **Create & link** (new Auth user) or **Link existing**.

### CLI

```bash
# All active fleet drivers without a login yet
node scripts/provision-drivers.mjs --all-unlinked

# Same temp password for a training cohort
node scripts/provision-drivers.mjs --all-unlinked --shared-password 'TempPass123'

# From CSV (columns: driver_id,email  OR  name,email)
node scripts/provision-drivers.mjs --csv drivers.csv
```

Writes `driver-logins-<timestamp>.csv` in the repo root. Passwords are not stored again.

Optional demo login only:

```bash
node scripts/provision-staff.mjs --driver-password 'YOUR_STRONG_PASSWORD'
```

---

## Field smoke test (5 min)

1. Phone → open `/get-driver` → install APK (or Safari Add to Home Screen on iPhone)  
2. Sign in as driver → Home  
3. Pick bus → Morning → Trip  
4. Allow location → chip shows **Sharing location**; blue dot on Google map  
5. **Navigate** (Google Maps) → **I'm here** at a stop  
6. Airplane mode 20s → reconnect → saved location sends  
7. **Report a delay** (optional) → **End trip**

Automated: `npm run test:driver` · `npm run smoke:driver`

---

## Handover contacts / owners

| Item | Owner |
|------|--------|
| Driver passwords / staff emails | Ops admin |
| Link `profiles.driver_id` | Admin → Drivers |
| APK rebuild | `npm run mobile:apk` (Java 21) |
| Play Store / iOS | Deferred v2.1 |

---

## Verdict

**Soft-launch ready** once a driver login exists and is linked.  
Not Play Store ready (debug APK). iPhone = web/PWA only.
