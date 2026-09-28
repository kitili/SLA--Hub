# Silverleaf Driver — mobile app (APK + web)

**Handover pack:** [`docs/DRIVER_APP_HANDOVER.md`](./DRIVER_APP_HANDOVER.md)  
**Field go-live:** [`docs/DRIVER_GO_LIVE.md`](./DRIVER_GO_LIVE.md)  
**v2.0 scope / action points:** [`docs/DRIVER_APP_V2.md`](./DRIVER_APP_V2.md)

The driver experience is the same product in three skins:

| Surface | URL / artifact | Use when |
|---------|----------------|----------|
| **Web (mobile)** | https://ops-transport-system.vercel.app/driver | Quick test in Chrome |
| **PWA / home screen** | Install from Account tab | No APK sideload needed |
| **Android APK** | Capacitor wrapper (`mobile/`) | Downloadable “real app” icon |

The APK is a **native shell** (Capacitor) that loads the live `/driver` app so boarding APIs, auth, optimize, and GPS outbox stay accurate. It is not a separate offline-only clone.

Public install page (no login): `/get-driver`

Bottom tabs: **Home** · **Path** (`/driver/path`) · **Account** (`/driver/more`)
`/driver/navigate` redirects to `/driver/path`.

---

## Build a debug APK (downloadable)

### Requirements
- Node 20+
- Android SDK (`~/Android/Sdk` with platform 34 + build-tools)
- Java 17

### One-time setup

```bash
cd ~/OPS_SYSTEM
npm install
npx cap add android   # creates ./android (skip if already present)
```

### Build

Needs **Java 21** (Capacitor 8). A portable JDK may live at `~/.local/jdk/jdk-21*`.

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
# optional if not auto-detected:
# export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12+8"

npm run mobile:apk
```

APK paths:

```text
android/app/build/outputs/apk/debug/app-debug.apk
public/downloads/sl-driver.apk   ← also published on the live site
```

**Download on a phone:**  
https://ops-transport-system.vercel.app/downloads/sl-driver.apk  

Open the file → allow “Install unknown apps” → Install → open **SL Driver**.

### What the APK opens
`https://ops-transport-system.vercel.app/driver` (see `capacitor.config.ts`).

Sign in with a user whose `profiles.role = driver`.

Optional: run `supabase/migrate_driver_profile_link.sql` and set `profiles.driver_id` so their bus auto-selects.

---

## Features (through Phase 4)

1. Searchable bus list (100+ ready)
2. AM/PM trip start + durable resume
3. Optimized stop order + Path (streets) / Polyline map toggle
4. Live GPS with IndexedDB outbox (survives calls/offline)
5. Matron boarding outbox (same resilience on scan phone)
6. Admin “GPS alert >2 min” on buses-online widget
7. Account tab: profile, tips, APK download

---

## Demo beat (add to soft-launch)

1. Driver APK (or `/driver`) → start AM → Path → confirm Road lines.
2. Matron `/matron/scan` on second phone for the same trip.
3. Put matron phone on a call for ~60s — driver GPS should keep the admin live map green.
4. Toggle airplane mode on driver for 20s — queue banner → reconnect → updates flush.
5. Admin dashboard → Buses online → GPS alert tile stays 0 while driver is healthy.
