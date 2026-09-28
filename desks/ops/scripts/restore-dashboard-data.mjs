/**
 * Restore demo/ops visibility data so admin dashboards aren't empty.
 * Uses service role from .env.local. Safe to re-run (fixed IDs / upserts).
 *
 * Does NOT wipe roster — schools/students/buses/routes stay intact.
 * Run: node scripts/restore-dashboard-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function req(method, pathAndQuery, body, extraPrefer) {
  const h = { ...headers };
  if (extraPrefer) h.Prefer = extraPrefer;
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: h,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathAndQuery} → ${res.status} ${text}`);
  }
  return json;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

const SCHOOL = "a1000000-0000-4000-8000-000000000001";
const BUS1 = "c1000000-0000-4000-8000-000000000001";
const BUS2 = "c1000000-0000-4000-8000-000000000002";
const DEMO_ROUTE = "e2000000-0000-4000-8000-000000000001";

async function restoreMajundoDemo() {
  console.log("→ Majundo demo route…");
  await req(
    "POST",
    "routes?on_conflict=id",
    [
      {
        id: DEMO_ROUTE,
        school_id: SCHOOL,
        name: "Majundo Soft-Launch Demo AM",
        direction: "am",
        active: true,
      },
    ],
    "resolution=merge-duplicates,return=minimal",
  );

  const stops = [
    ["f2000000-0000-4000-8000-000000000001", "Usariver Campus (Demo depot)", -3.3725, 36.6942, "school"],
    ["f2000000-0000-4000-8000-000000000002", "Ngaramtoni West Gate", -3.35, 36.655, "pickup"],
    ["f2000000-0000-4000-8000-000000000003", "Tengeru Far East", -3.385, 36.845, "pickup"],
    ["f2000000-0000-4000-8000-000000000004", "Nkoaranga North", -3.33, 36.71, "pickup"],
    ["f2000000-0000-4000-8000-000000000005", "USA River Town Centre", -3.368, 36.87, "pickup"],
    ["f2000000-0000-4000-8000-000000000006", "Moshono Junction", -3.36, 36.73, "pickup"],
    ["f2000000-0000-4000-8000-000000000007", "Kisongo Spur", -3.4, 36.68, "pickup"],
  ].map(([id, name, lat, lng, kind]) => ({
    id,
    school_id: SCHOOL,
    name,
    lat,
    lng,
    kind,
  }));

  await req(
    "POST",
    "stops?on_conflict=id",
    stops,
    "resolution=merge-duplicates,return=minimal",
  );

  // Clear then reinsert route_stops for demo
  await fetch(
    `${url}/rest/v1/route_stops?route_id=eq.${DEMO_ROUTE}`,
    { method: "DELETE", headers },
  );

  const etas = [0, 22, 55, 72, 95, 110, 125];
  const routeStops = stops.map((s, i) => ({
    route_id: DEMO_ROUTE,
    stop_id: s.id,
    stop_order: i,
    eta_offset_minutes: etas[i],
  }));
  await req("POST", "route_stops", routeStops, "return=minimal");
  console.log("  demo route + 7 stops OK");
}

async function restoreFinance() {
  console.log("→ August finance samples…");
  const today = isoDate(new Date());
  const d = (n) => isoDate(daysAgo(n));

  await req(
    "POST",
    "budgets?on_conflict=id",
    [
      {
        id: "e3100000-0000-4000-8000-000000000001",
        school_id: SCHOOL,
        name: "Usariver Fuel Q3",
        category: "fuel",
        period_start: `${today.slice(0, 8)}01`,
        period_end: isoDate(new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0)),
        amount: 8000000,
        currency: "TZS",
        notes: "Demo fuel envelope",
      },
      {
        id: "e3100000-0000-4000-8000-000000000002",
        school_id: SCHOOL,
        name: "Usariver Ops Q3",
        category: "ops",
        period_start: `${today.slice(0, 8)}01`,
        period_end: isoDate(new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0)),
        amount: 15000000,
        currency: "TZS",
        notes: "Catch-all ops budget",
      },
    ],
    "resolution=merge-duplicates,return=minimal",
  );

  await req(
    "POST",
    "expenses?on_conflict=id",
    [
      {
        id: "e3200000-0000-4000-8000-000000000001",
        school_id: SCHOOL,
        bus_id: BUS1,
        category: "fuel",
        title: "Diesel fill — T 910 APW",
        amount: 450000,
        currency: "TZS",
        spent_on: d(2),
        notes: "Demo expense",
      },
      {
        id: "e3200000-0000-4000-8000-000000000002",
        school_id: SCHOOL,
        bus_id: BUS1,
        category: "maintenance",
        title: "Brake pads",
        amount: 280000,
        currency: "TZS",
        spent_on: d(5),
        notes: null,
      },
      {
        id: "e3200000-0000-4000-8000-000000000003",
        school_id: SCHOOL,
        bus_id: null,
        category: "insurance",
        title: "Fleet third-party top-up",
        amount: 1200000,
        currency: "TZS",
        spent_on: d(10),
        notes: null,
      },
      {
        id: "e3200000-0000-4000-8000-000000000004",
        school_id: SCHOOL,
        bus_id: null,
        category: "salary",
        title: "Matron stipend (week)",
        amount: 350000,
        currency: "TZS",
        spent_on: d(1),
        notes: null,
      },
    ],
    "resolution=merge-duplicates,return=minimal",
  );

  await req(
    "POST",
    "revenues?on_conflict=id",
    [
      {
        id: "e3300000-0000-4000-8000-000000000001",
        school_id: SCHOOL,
        bus_id: null,
        category: "transport_fees",
        title: "Transport fees — week collection",
        amount: 5200000,
        currency: "TZS",
        earned_on: d(1),
        notes: "Demo fee intake",
      },
      {
        id: "e3300000-0000-4000-8000-000000000002",
        school_id: SCHOOL,
        bus_id: BUS1,
        category: "hire_out",
        title: "Weekend wedding hire",
        amount: 900000,
        currency: "TZS",
        earned_on: d(3),
        notes: null,
      },
    ],
    "resolution=merge-duplicates,return=minimal",
  );

  const hireStart = new Date(daysAgo(3));
  hireStart.setHours(8, 0, 0, 0);
  const hireEnd = new Date(daysAgo(3));
  hireEnd.setHours(20, 0, 0, 0);
  const upcomingStart = new Date(daysAgo(-2));
  upcomingStart.setHours(7, 0, 0, 0);
  const upcomingEnd = new Date(daysAgo(-2));
  upcomingEnd.setHours(18, 0, 0, 0);

  await req(
    "POST",
    "hire_outs?on_conflict=id",
    [
      {
        id: "e3400000-0000-4000-8000-000000000001",
        bus_id: BUS1,
        school_id: SCHOOL,
        client_name: "Mwangi family",
        purpose: "wedding",
        start_at: hireStart.toISOString(),
        end_at: hireEnd.toISOString(),
        quoted_amount: 900000,
        currency: "TZS",
        status: "completed",
        notes: "Demo hire-out",
        revenue_id: "e3300000-0000-4000-8000-000000000002",
      },
      {
        id: "e3400000-0000-4000-8000-000000000002",
        bus_id: BUS2,
        school_id: SCHOOL,
        client_name: "Community burial committee",
        purpose: "burial",
        start_at: upcomingStart.toISOString(),
        end_at: upcomingEnd.toISOString(),
        quoted_amount: 650000,
        currency: "TZS",
        status: "booked",
        notes: "Upcoming — bus CPP",
        revenue_id: null,
      },
    ],
    "resolution=merge-duplicates,return=minimal",
  );

  await req(
    "PATCH",
    "revenues?id=eq.e3300000-0000-4000-8000-000000000002",
    { hire_out_id: "e3400000-0000-4000-8000-000000000001" },
    "return=minimal",
  );
  console.log("  budgets/expenses/revenues/hire_outs OK");
}

async function restoreBoardingTrend() {
  console.log("→ Last-7-days boarding (dashboard trend)…");

  const students = await req(
    "GET",
    "students?select=id&active=eq.true&order=last_name&limit=80",
  );
  if (!students?.length) {
    console.warn("  no students — skip boarding");
    return;
  }

  const buses = [BUS1, BUS2];
  let eventsCreated = 0;
  let tripsTouched = 0;

  for (let day = 6; day >= 0; day--) {
    const date = isoDate(daysAgo(day));
    for (const busId of buses) {
      for (const direction of ["am", "pm"]) {
        // Find or create trip
        let trips = await req(
          "GET",
          `trips?bus_id=eq.${busId}&trip_date=eq.${date}&direction=eq.${direction}&select=id`,
        );
        let tripId = trips?.[0]?.id;
        if (!tripId) {
          const started = new Date(`${date}T${direction === "am" ? "06:30:00" : "14:30:00"}+03:00`);
          const ended = new Date(`${date}T${direction === "am" ? "08:15:00" : "16:45:00"}+03:00`);
          const created = await req(
            "POST",
            "trips",
            [
              {
                bus_id: busId,
                trip_date: date,
                direction,
                status: "completed",
                started_at: started.toISOString(),
                ended_at: ended.toISOString(),
                departed_school_at:
                  direction === "pm" ? started.toISOString() : null,
              },
            ],
            "return=representation",
          );
          tripId = created?.[0]?.id;
        }
        if (!tripId) continue;
        tripsTouched += 1;

        // Skip if this trip already has boardings
        const existing = await req(
          "GET",
          `boarding_events?trip_id=eq.${tripId}&select=id&limit=1`,
        );
        if (existing?.length) continue;

        // ~8–18 students per trip, rotated through roster
        const offset = (day * 4 + (direction === "am" ? 0 : 2) + buses.indexOf(busId)) %
          Math.max(1, students.length - 20);
        const count = 8 + ((day + buses.indexOf(busId) + (direction === "am" ? 0 : 3)) % 11);
        const slice = students.slice(offset, offset + count);
        if (!slice.length) continue;

        const rows = slice.map((s, i) => {
          const scanned = new Date(
            `${date}T${direction === "am" ? "06" : "14"}:${String(35 + i).padStart(2, "0")}:00+03:00`,
          );
          return {
            trip_id: tripId,
            student_id: s.id,
            event_type: "in",
            scanned_at: scanned.toISOString(),
          };
        });
        await req("POST", "boarding_events", rows, "return=minimal");
        eventsCreated += rows.length;
      }
    }
  }

  console.log(`  trips touched ${tripsTouched}, boarding events inserted ${eventsCreated}`);
}

async function verify() {
  console.log("→ Verify counts…");
  async function count(table, query = "select=id") {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: {
        ...headers,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    return res.headers.get("content-range")?.split("/")[1] ?? "?";
  }
  const tables = [
    "students",
    "buses",
    "routes",
    "boarding_events",
    "trips",
    "revenues",
    "expenses",
    "budgets",
    "hire_outs",
  ];
  for (const t of tables) {
    console.log(`  ${t}: ${await count(t)}`);
  }
  const demo = await req(
    "GET",
    `routes?id=eq.${DEMO_ROUTE}&select=name`,
  );
  console.log(`  majundo demo: ${demo?.[0]?.name ?? "MISSING"}`);
}

try {
  await restoreMajundoDemo();
  await restoreFinance();
  await restoreBoardingTrend();
  await verify();
  console.log("\nDone. Hard-refresh admin dashboard.");
} catch (e) {
  console.error("\nFAILED:", e.message ?? e);
  process.exit(1);
}
