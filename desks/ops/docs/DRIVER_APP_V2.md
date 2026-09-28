# Driver App v2.0 — scope & action points

**Status:** Soft-launch ready (field use)  
**Base:** Soft-launch v1 (Phases 1–4) — see [`DRIVER_APP.md`](./DRIVER_APP.md) + [`DRIVER_APP_HANDOVER.md`](./DRIVER_APP_HANDOVER.md) + [`DRIVER_GO_LIVE.md`](./DRIVER_GO_LIVE.md)

## Goal

Make the driver app safer for multi-driver use, clearer on the road (Bolt-like Path), and easier for admins to assign buses — without waiting on Play Store / iOS packaging.

## v2.0 includes

| # | Action | Layer | Done |
|---|--------|-------|------|
| 1 | Per-driver bus/trip ownership on APIs | Backend | ✅ |
| 2 | Admin: link login profile → fleet `driver_id` | Admin UI + API | ✅ |
| 3 | Open next stop in Google / Apple Maps | Path FE | ✅ |
| 4 | Live distance + ETA from GPS to next stop | Path FE | ✅ |
| 5 | Arrived / skip stop + auto-advance near stop | Path FE | ✅ |
| 6 | Quick delay report from Path | Path FE + incidents API | ✅ |
| 7 | Version badge **2.0** in Account | FE | ✅ |

### Ops before field use
1. ~~Deploy this branch to Vercel.~~ ✅  
2. ~~`profiles.driver_id`~~ ✅ in prod  
3. Admin → Drivers → **Link Driver app login** (demo: `driver@silverleaf.co.tz` → Agaeli) ✅  
4. Run [`APPLY_DRIVER_GO_LIVE.sql`](../supabase/APPLY_DRIVER_GO_LIVE.sql) for street Path cache  
5. Smoke-test Path on phone: Open in Maps, Arrived, Report delay

## Explicitly deferred (v2.1+)

- Signed Play Store APK / keystore pipeline  
- iOS Capacitor + TestFlight  
- Android foreground location service hardening  
- Full in-app turn-by-turn SDK  
- Offline map tiles  

## Acceptance

1. Linked driver cannot start another driver’s bus (403).  
2. Admin can link email → driver from Drivers page.  
3. Path shows distance/ETA, Maps button, Arrived, Report delay.  
4. Account shows **Driver app 2.0**.
