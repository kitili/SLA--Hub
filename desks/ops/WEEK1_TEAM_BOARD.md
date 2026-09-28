# Majundo Ops — Week 1 Team Board (Days 1–5)

**Team:** Kai · Amos · Jfree · Irene  
**Week goal:** Matron can start a trip, scan a student QR, see GPS + fee balance, record time-in/out, and a parent gets SMS/WhatsApp. Admin sees today’s boarding list.

**How to use:** Find your name under today’s day. Do the **Work** column. Also do your **Duty** for that day. Demo at end of Day 3 and Day 5.

**Board hygiene:** After every pull request (open or merge), update this file so Status matches what actually shipped in the repo.

---

## Who owns what (fixed)


| Person    | Owns                                                                 |
| --------- | -------------------------------------------------------------------- |
| **Kai**   | Backend spine: Next.js, Supabase, schema, APIs, fees sync, messaging |
| **Amos**  | Matron phone UI: scan, GPS, boarding screens                         |
| **Jfree** | Buses, trips, occupancy (routes come Week 2)                         |
| **Irene** | Fees seed data, admin panels, permissions docs, KPI shells           |


---



## Day 1 — Kickoff & skeleton

**Done when:** App runs; login works for `admin` and `matron`.  
**Status:** Day 1 complete for Kai · Amos · Jfree · Irene.


| Person    | Work                                                                                 | Duty       | Status |
| --------- | ------------------------------------------------------------------------------------ | ---------- | ------ |
| **Kai**   | Create Next.js app, Supabase project, `.env.example`, auth roles (`admin`, `matron`) | Captain    | ✅ Done |
| **Amos**  | Matron layout shell (mobile-first) + ask for geolocation permission                  | Integrator | ✅ Done |
| **Jfree** | Buses table UI stub + seed 2–3 buses                                                 | QA Hawk    | ✅ Done |
| **Irene** | Admin dashboard shell + empty KPI card placeholders                                  | Docs Scout | ✅ Done |


**Hand-off notes**

- Kai: share `.env.example` + how to run locally before lunch.
- Amos/Jfree/Irene: wait for Kai’s repo skeleton, then open PRs against `main`.

---



## Day 2 — Schema & students

**Done when:** Seed script loads demo Majundo data.  
**Status:** Day 2 complete for Kai · Amos · Jfree · Irene.


| Person    | Work                                                                                                  | Duty       | Status |
| --------- | ----------------------------------------------------------------------------------------------------- | ---------- | ------ |
| **Kai**   | SQL schema v1: `students`, `parents`, `qr_codes`, `buses`, `trips`, `boarding_events`, `fee_balances` | Integrator | ✅ Done |
| **Amos**  | Student list page (read-only) + QR display component                                                  | QA Hawk    | ✅ Done |
| **Jfree** | Trip stub: create morning / evening trip for a bus                                                    | Docs Scout | ✅ Done |
| **Irene** | Seed fee balances + parent phone numbers for ~20 demo students                                        | Captain    | ✅ Done |


---



## Day 3 — QR + Sprint 1 demo

**Demo gate:** Login → see students → show QR → scanner opens camera.  
**Status:** Day 3 complete for Kai · Amos · Jfree · Irene.


| Person    | Work                                                          | Duty       | Status |
| --------- | ------------------------------------------------------------- | ---------- | ------ |
| **Kai**   | API: resolve QR → student; generate QR tokens                 | QA Hawk    | ✅ Done |
| **Amos**  | Camera QR scanner page wired to Kai’s API (GPS can be mocked) | Docs Scout | ✅ Done |
| **Jfree** | Bus detail page showing capacity                              | Captain    | ✅ Done |
| **Irene** | Roles/permissions matrix written + enforced on admin routes   | Integrator | ✅ Done |


---



## Day 4 — Boarding events

**Done when:** Scan writes time-in/out; occupancy moves; admin sees history.  
**Status:** Day 4 complete for Kai · Amos · Jfree · Irene.


| Person    | Work                                                        | Duty       | Status |
| --------- | ----------------------------------------------------------- | ---------- | ------ |
| **Kai**   | `POST /api/boarding` — time-in/out, reject duplicate scans  | Docs Scout | ✅ Done |
| **Amos**  | Scan flow: start trip → scan → success UI with student name | Captain    | ✅ Done |
| **Jfree** | Occupancy counter API + UI on trip page                     | Integrator | ✅ Done |
| **Irene** | Boarding history table for admin                            | QA Hawk    | ✅ Done (`/admin/boarding`) |


---



## Day 5 — Fees + GPS (Week 1 mid-check)

**Done when:** Fee balance shows on scan; GPS stored; fee sync stub exists; fee balance / policy-based-on-balance UX exists.  
**Status:** Day 5 complete for Kai · Amos · Jfree · Irene (Irene: fee balance display on scan + `/admin/students`).


| Person    | Work                                                                       | Duty       | Status |
| --------- | -------------------------------------------------------------------------- | ---------- | ------ |
| **Kai**   | Fee lookup on boarding response; cron stub `sync-fees` (CSV → Supabase)    | Captain    | ✅ Done |
| **Amos**  | Capture GPS on app open + on each scan; show fee balance on success screen | Integrator | ✅ Done |
| **Jfree** | `trip_locations` write endpoint (for later live map)                       | QA Hawk    | ✅ Done (`POST /api/trips/[tripId]/locations` + last ping on bus detail) |
| **Irene** | Fee balance display / policy based on balance (scan + admin fee views)     | Docs Scout | ✅ Done (balance on scan + `/admin/students` owes/clear; **no** configurable fee-policy UI / `/admin/fees` — that part stays plan-only) |


**Note:** Parent SMS/WhatsApp is **Day 6** (Kai). Stub works without provider keys.

---



## Day 6 — Parent messaging + Week 1 demo

**Done when:** Parent gets SMS (or stub) on boarding; `message_logs` written; Amos/Irene can show status.  
**Status:** Day 6 complete for Kai · Amos · Jfree · Irene.


| Person    | Work                                                            | Duty       | Status |
| --------- | --------------------------------------------------------------- | ---------- | ------ |
| **Kai**   | Integrate Africa’s Talking **or** stub; `message_logs`; wire boarding | Captain | ✅ Done |
| **Amos**  | Matron sees “Parent notified ✓ / failed”                        | Integrator | ✅ Done |
| **Jfree** | Today’s roster per bus (who is on)                              | QA Hawk    | ✅ Done (roster on `/admin/buses/[id]`) |
| **Irene** | Admin “Messages sent today” panel                               | Docs Scout | ✅ Done (`/admin/messages`) |


---



## Folder ownership (don’t step on each other)


| Path                                                      | Owner |
| --------------------------------------------------------- | ----- |
| `src/app/api/**`, `supabase/**`, `src/lib/**`             | Kai   |
| `src/app/(matron)/**`, matron components                  | Amos  |
| `src/app/(admin)/buses/**`, trips, occupancy              | Jfree |
| `src/app/(admin)/dashboard/**`, finance shells, seed fees | Irene |


Shared: auth layout, design tokens — ask Kai before changing.

---



## Standup (10 min)

1. Yesterday shipped?
2. Blockers?
3. Confirm today’s duty roles (table above).
4. One demoable outcome for today.

---



## Checklist

- [x] Day 1 done (Kai · Amos · Jfree · Irene)
- [x] Day 2 done (schema + seed + students/buses/trips stubs)
- [x] Day 3 Sprint 1 demo passed (Kai · Amos · Jfree bus detail · Irene permissions)
- [x] Day 4 — Kai: `POST /api/boarding`
- [x] Day 4 — Amos: start trip → scan → board success UI
- [x] Day 4 — Jfree: occupancy counter on trip / buses UI
- [x] Day 4 — Irene: admin boarding history (`/admin/boarding`)
- [x] Day 5 — Kai: fee on boarding + `sync-fees` stub
- [x] Day 5 — Amos: GPS on open + each scan; fee on success
- [x] Day 5 — Jfree: `trip_locations` write + last ping on bus detail
- [x] Day 5 — Irene: fee balance display (scan + `/admin/students`; fee-policy settings still plan-only)
- [x] Day 6 — Kai: parent notify + `message_logs` (+ Africa’s Talking or stub)
- [x] Day 6 — Amos: Parent notified ✓ / failed on success card
- [x] Day 6 — Jfree: today’s roster per bus on bus detail
- [x] Day 6 — Irene: admin “Messages sent today” (`/admin/messages`)

**Amos Week 1:** ✅ complete — see `WEEK2_TEAM_BOARD.md` for Days 7–12.  
**Irene Week 1:** ✅ complete — Days 1–6 (Day 5 = fee balance display on scan + `/admin/students`, not a fee-policy engine; `/admin/dashboard`, fee seed, permissions, `/admin/boarding`, `/admin/messages`).  
**Week 1 (all):** ✅ complete for Kai · Amos · Jfree · Irene — see `WEEK2_TEAM_BOARD.md` for Days 7–12.  
**Countercheck (2026-07-29 on `kiki`):** All Day 1–6 ✅ rows have code evidence. Irene Day 5 kept ✅ for balance display; configurable fee policy remains board/plan-only.
**Boards:** [`WEEK2_TEAM_BOARD.md`](./WEEK2_TEAM_BOARD.md) (Days 7–12) · [`WEEK3_TEAM_BOARD.md`](./WEEK3_TEAM_BOARD.md) (Days 13–15).

**Day 1 login users (passwords with Kai only):**
- Admin: `baraka@silverleaf.co.tz` → `/admin/dashboard`
- Matron: `matron@silverleaf.co.tz` → `/matron`

Questions go to **Kai**. Do not invent new tables without Kai.
