# Majundo Ops — Week 2 Team Board (Days 7–12)

**Team:** Kai · Amos · Jfree · Irene  
**Week goal:** Routes with stops + Optimize; matron live GPS pings; admin live map; incidents; maintenance.

**Week 1 Amos:** ✅ Complete (Days 1–6 matron shell, students/QR, scanner, trip→scan→board, GPS+fee, parent notify).

**Week 2 status (counterchecked 2026-07-29 on `kiki` — all ✅ have code):**  
- **Kai** ✅ Complete (schema/APIs: routes, stops, optimize capacity, live locations, incidents, maintenance)  
- **Amos** ✅ Complete (next stops, optimized order, GPS pings + left-school, report incident, scan polish)  
- **Irene** ✅ Complete (stop assignment, km KPI card, buses-online widget, admin incidents, maintenance expense-link)  
- **Jfree** ✅ Complete (route builder map/drag, polyline, export sheet, live map, occupancy alarms, maintenance UI)

**Board hygiene:** After every PR, update Status to match what shipped.

---

## Who owns what (fixed)

| Person | Owns |
|--------|------|
| **Kai** | Schema/APIs: routes, stops, trip_locations realtime, incidents, maintenance |
| **Amos** | Matron: next stops, live GPS pings, left-school, incident report, scan polish |
| **Jfree** | Route builder, optimize, live map, occupancy alarms, maintenance UI |
| **Irene** | Student↔stop assignment, km KPI, buses-online widget, incidents admin |

---

## Day 7 — Routes & stops CRUD

**Done when:** Routes/stops exist; matron sees ordered next stops on an active trip.  
**Status:** Kai + Amos + Irene + Jfree ✅

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | Tables + APIs: `routes`, `stops`, `route_stops`, `student_stop_assignments` | Captain | ✅ Done (schema + CRUD APIs) |
| **Amos** | Matron trip view: next stops list (ordered) | Integrator | ✅ Done |
| **Jfree** | Route builder UI (map + drag reorder) | QA Hawk | ✅ Done (`/admin/routes` + `/admin/routes/[routeId]` Leaflet map + drag reorder) |
| **Irene** | Student → stop assignment admin UI | Docs Scout | ✅ Done (`/admin/assignments` → `POST /api/student-stops`) |

---

## Day 8 — Optimize engine

**Status:** Kai + Amos + Irene + Jfree ✅

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | Capacity constraints in optimize API | Integrator | ✅ Done (capacity gate + force) |
| **Amos** | Show optimized stop order (+ static ETAs ok) | Captain | ✅ Done |
| **Jfree** | `POST /api/routes/[routeId]/optimize` (NN + 2-opt) + polyline | Docs Scout | ✅ Done (optimize API + route map polyline after optimize) |
| **Irene** | Before/after km KPI card | QA Hawk | ✅ Done (dashboard `KmOptimizeCard` from optimize API `before_km` / `km_saved`) |

---

## Day 9 — Sprint 3 demo

**Status:** Kai + Jfree ✅ · seed route ✅ (`supabase/seed_routes.sql`)

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **All** | Bugfix route builder; seed 1 real route | — | ✅ Seed done · matron fleet auto-order + admin drag builder |
| **Jfree** | Export stop sheet for driver/matron | Captain | ✅ Done (CSV export + printable stop sheet on route builder) |
| **Kai** | Admin-only optimize permissions | Integrator | ✅ Done |

**Demo gate:** Create route → assign students → Optimize → matron sees new order.  
**(Ready: admin builder + optimize + Irene assignment + Amos matron stops.)**

---

## Day 10 — Live locations

**Status:** Kai + Amos + Irene + Jfree ✅

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | `trip_locations` + realtime channel | Docs Scout | ✅ Done (write + live GET + realtime SQL) |
| **Amos** | GPS ping every 15–30s while trip active + “Left school” | QA Hawk | ✅ Done |
| **Jfree** | Admin live map (active buses) | Captain | ✅ Done (`/admin/live` polls `GET /api/trips/live`) |
| **Irene** | Dashboard: buses online now | Integrator | ✅ Done (`BusesOnlineWidget` on `/admin/dashboard` → `GET /api/trips/live`) |

---

## Day 11 — Incidents + occupancy

**Status:** Kai + Amos + Irene + Jfree ✅

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | Incidents API (+ optional admin SMS) | Captain | ✅ Done (GET/POST + admin SMS stub) |
| **Amos** | “Report incident” on matron trip screen | Integrator | ✅ Done |
| **Jfree** | Occupancy % vs capacity alarms | QA Hawk | ✅ Done (alarms + meters on `/admin/buses` + bus detail) |
| **Irene** | Incidents list + severity filters | Docs Scout | ✅ Done (`/admin/incidents` + AdminShell nav → `GET /api/incidents`) |

---

## Day 12 — Maintenance + Week 2 demo

**Status:** Kai + Amos + Irene + Jfree ✅

| Person | Work | Duty | Status |
|--------|------|------|--------|
| **Kai** | Maintenance schema + cost fields | Integrator | ✅ Done (`schema_maintenance.sql` + API; optional `createExpense`) |
| **Amos** | Scan UX polish (errors, torch, offline toast) | Docs Scout | ✅ Done |
| **Jfree** | Maintenance & repair UI | Captain | ✅ Done (`/admin/maintenance` → list/create via `GET/POST /api/maintenance`) |
| **Irene** | Link maintenance costs to expenses | QA Hawk | ✅ Done (`MaintenanceExpenseForm` + `createExpense` / `expenseId`) |

**Week 2 demo gate:** Live map moving + incident logged + maintenance record + occupancy accurate.  
**(Ready: matron GPS/incident + Kai APIs + admin live map + occupancy alarms + maintenance UI.)**

---

## Checklist

- [x] Day 7 — routes/stops + matron next stops + Jfree map/drag builder + Irene assignment ✅
- [x] Day 8 — optimize + ETAs + capacity gate + map polyline + Irene km KPI ✅
- [x] Day 9 — admin optimize + seed + export stop sheet + builder bug fix ✅
- [x] Day 10 — matron GPS + live GET + Irene buses-online + Jfree admin live map ✅
- [x] Day 11 — incidents + Irene admin list + Jfree occupancy alarms ✅
- [x] Day 12 — scan polish + maintenance API + Jfree maintenance UI + Irene expense-link ✅

**Submitted — Amos Week 2:** ✅ complete (Days 7–8, 10–12).  
**Submitted — Kai Week 2 APIs:** ✅ complete.  
**Submitted — Irene Week 2 admin UI:** ✅ complete (assignments, km KPI, buses-online, incidents, expense-link).  
**Submitted — Jfree Week 2 UI:** ✅ complete (route builder map/drag, polyline, export, live map, occupancy alarms, maintenance UI).

**Next:** Week 3 finance — see [`WEEK3_TEAM_BOARD.md`](./WEEK3_TEAM_BOARD.md) (Kai + Amos submitted; Jfree/Irene UI open).

**SQL to run (Kai):** `schema_auth.sql` → `schema_v1.sql` → `schema_week2.sql` → `schema_incidents.sql` → `schema_maintenance.sql` → `schema_day45.sql` / `schema_day6.sql` → seeds (`seed_routes.sql`). Do **not** run deprecated `schema_transport.sql`.
