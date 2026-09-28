# Driver app — handover pack

**Product:** Silverleaf Driver (`SL Driver`) · **Version 2.0**  
**Live web:** https://ops-transport-system.vercel.app/driver  
**Public APK page:** https://ops-transport-system.vercel.app/get-driver  
**APK direct:** https://ops-transport-system.vercel.app/downloads/sl-driver.apk  
**Go-live checklist:** [`DRIVER_GO_LIVE.md`](./DRIVER_GO_LIVE.md)  
**Driver documents / renewals:** [`DRIVER_DOCUMENTS.md`](./DRIVER_DOCUMENTS.md)  
**Build notes:** [`DRIVER_APP.md`](./DRIVER_APP.md) · **v2 scope:** [`DRIVER_APP_V2.md`](./DRIVER_APP_V2.md)

---

## 1. Readiness verdict

| Layer | Status | Meaning |
|-------|--------|---------|
| **Frontend (web + APK shell)** | **Ready** | Home · Path · Account; GPS outbox; Path/Polyline; install UX; v2 Maps / Arrived / delay |
| **Backend / API** | **Ready for soft-launch** | Trip + GPS + geometry + **per-driver bus ownership** when linked |
| **Database** | **Ready** (one optional SQL) | `profiles.driver_id` live; run `APPLY_DRIVER_GO_LIVE.sql` for ORS cache |
| **Mobile packaging** | **Soft-launch ready** | Debug APK sideload; no Play Store / iOS native yet |
| **Auth / roles** | **Ready** | `driver` + `admin`; public `/get-driver` |

**Overall: Ready for field soft-launch.** Hand this pack + go-live doc to ops.

---

## 2. What the app does today

| Tab | Route | Job |
|-----|-------|-----|
| **Home** | `/driver` | Pick bus, start/resume Morning or Afternoon |
| **Path** | `/driver/path` | Next stop, live distance/ETA, Open in Maps, Arrived, Path/Polyline, delay report, End trip |
| **Account** | `/driver/more` | Profile, tips, Download APK, sign out |

Also: Capacitor APK loads live Vercel `/driver`; GPS queues offline; admin GPS-stale tile on buses-online.

---

## 3. Architecture

```text
Phone (APK WebView or Chrome/Safari)
  └─ Next.js /driver UI  (Vercel)
       ├─ Server components → Supabase (user JWT + RLS)
       └─ Client fetch → /api/trips/* , /api/routes/geometry
            └─ buses / trips / routes / stops / trip_locations / profiles.driver_id
```

---

## 4. Key files

| Area | Path |
|------|------|
| Layout / auth | `src/app/(driver)/layout.tsx` |
| Pages | `src/app/(driver)/driver/**` |
| UI | `src/components/driver/*` |
| Ownership | `src/lib/driver/access.ts` |
| Session / assigned bus | `src/lib/driver/session.ts` |
| Admin link login | `src/app/api/drivers/[id]/link-login/route.ts` + Drivers UI |
| Capacitor | `capacitor.config.ts`, `android/` |
| Go-live SQL | `supabase/APPLY_DRIVER_GO_LIVE.sql` |

---

## 5. APIs (driver)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/trips` | Start AM/PM (ownership checked) |
| `GET` | `/api/trips/[id]/stops` | Stops (+ `?optimized=1`) |
| `POST` | `/api/trips/[id]/locations` | GPS ping |
| `POST` | `/api/trips/[id]/depart` | Left school |
| `POST` | `/api/trips/[id]/complete` | End trip |
| `POST` | `/api/routes/geometry` | Street Path line |
| `POST` | `/api/drivers/[id]/link-login` | Admin: email → `profiles.driver_id` |
| `POST` | `/api/incidents` | Delay report from Path |

---

## 6. Ops checklist

- [x] Deploy Driver App v2 to Vercel  
- [x] `profiles.driver_id` column in prod  
- [x] Demo login `driver@silverleaf.co.tz` linked to fleet driver (Agaeli / HIACE)  
- [ ] Run `supabase/APPLY_DRIVER_GO_LIVE.sql` (ORS cache)  
- [ ] Confirm `ORS_API_KEY` on Vercel (street Path)  
- [ ] Smoke test on a real Android phone  
- [ ] Link each real driver email in Admin → Drivers  

---

## 7. Deferred (v2.1+)

Signed Play Store APK · iOS Capacitor · foreground GPS service · full in-app turn-by-turn · offline tiles

---

## 8. Quick answers

**Is FE OK?** Yes — soft-launch.  
**Is API OK?** Yes — with ownership for linked drivers.  
**Is DB OK?** Yes — optional geometry cache SQL left.  
**iPhone?** Web / Add to Home Screen.  
**Ready for handover?** Yes — use this + [`DRIVER_GO_LIVE.md`](./DRIVER_GO_LIVE.md).
