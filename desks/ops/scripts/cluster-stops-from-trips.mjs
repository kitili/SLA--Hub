#!/usr/bin/env node
/**
 * Cluster trip_locations GPS pings into stops + route_stops.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   node scripts/cluster-stops-from-trips.mjs
 *   node scripts/cluster-stops-from-trips.mjs --apply
 *   node scripts/cluster-stops-from-trips.mjs --bus-id <uuid> --radius-m 75 --apply
 *   node scripts/cluster-stops-from-trips.mjs --route-id <uuid> --school-id <uuid>
 *
 * Run after real matron GPS accumulates. Not a replacement for seed_majundo_demo_route.sql.
 * See supabase/LOAD_REAL_DATA.md.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const EARTH_M = 6371000;
const DEFAULT_RADIUS_M = 75;
const MIN_POINTS = 3;
const MAX_STOPS_PER_ROUTE = 25;
/** Only touch routes that already have this many or fewer stops. */
const MAX_EXISTING_STOPS = 2;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = { apply: false, radiusM: DEFAULT_RADIUS_M };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") {
      out.apply = true;
      continue;
    }
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  if (out["radius-m"]) out.radiusM = Number(out["radius-m"]);
  if (out["bus-id"]) out.busId = out["bus-id"];
  if (out["route-id"]) out.routeId = out["route-id"];
  if (out["school-id"]) out.schoolId = out["school-id"];
  return out;
}

function haversineM(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Greedy distance clustering: first point seeds a cluster; later points join nearest within radius. */
export function clusterPoints(points, radiusM) {
  /** @type {{ lat: number, lng: number, count: number, sumLat: number, sumLng: number }[]} */
  const clusters = [];
  for (const p of points) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const center = { lat: c.sumLat / c.count, lng: c.sumLng / c.count };
      const d = haversineM(center, p);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0 && bestDist <= radiusM) {
      clusters[best].sumLat += p.lat;
      clusters[best].sumLng += p.lng;
      clusters[best].count += 1;
    } else {
      clusters.push({
        lat: p.lat,
        lng: p.lng,
        count: 1,
        sumLat: p.lat,
        sumLng: p.lng,
      });
    }
  }
  return clusters
    .map((c) => ({
      lat: c.sumLat / c.count,
      lng: c.sumLng / c.count,
      count: c.count,
    }))
    .filter((c) => c.count >= MIN_POINTS)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_STOPS_PER_ROUTE);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let busesQ = supabase
    .from("buses")
    .select("id, plate_number, label, school_id, route_id")
    .not("route_id", "is", null);

  if (args.busId) busesQ = busesQ.eq("id", args.busId);
  if (args.routeId) busesQ = busesQ.eq("route_id", args.routeId);
  if (args.schoolId) busesQ = busesQ.eq("school_id", args.schoolId);

  const { data: buses, error: busesErr } = await busesQ;
  if (busesErr) throw busesErr;
  if (!buses?.length) {
    console.log("No buses with route_id matched filters.");
    return;
  }

  const routeIds = [...new Set(buses.map((b) => b.route_id).filter(Boolean))];
  const { data: routeStopRows } = await supabase
    .from("route_stops")
    .select("route_id")
    .in("route_id", routeIds);

  const stopCountByRoute = new Map();
  for (const row of routeStopRows ?? []) {
    stopCountByRoute.set(
      row.route_id,
      (stopCountByRoute.get(row.route_id) ?? 0) + 1,
    );
  }

  const plans = [];

  for (const bus of buses) {
    const existing = stopCountByRoute.get(bus.route_id) ?? 0;
    if (existing > MAX_EXISTING_STOPS) {
      plans.push({
        bus,
        skip: `already has ${existing} route_stops (max ${MAX_EXISTING_STOPS} for auto-cluster)`,
      });
      continue;
    }

    const { data: trips, error: tripsErr } = await supabase
      .from("trips")
      .select("id")
      .eq("bus_id", bus.id)
      .limit(200);
    if (tripsErr) throw tripsErr;
    const tripIds = (trips ?? []).map((t) => t.id);
    if (tripIds.length === 0) {
      plans.push({ bus, skip: "no trips" });
      continue;
    }

    const { data: locs, error: locErr } = await supabase
      .from("trip_locations")
      .select("lat, lng, trip_id, recorded_at")
      .in("trip_id", tripIds)
      .limit(5000);
    if (locErr) throw locErr;

    const points = (locs ?? [])
      .filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      )
      .map((p) => ({ lat: p.lat, lng: p.lng }));

    if (points.length < MIN_POINTS) {
      plans.push({
        bus,
        skip: `only ${points.length} GPS points (need ≥${MIN_POINTS})`,
      });
      continue;
    }

    const clusters = clusterPoints(points, args.radiusM);
    if (clusters.length === 0) {
      plans.push({ bus, skip: "no clusters met min point threshold" });
      continue;
    }

    plans.push({
      bus,
      points: points.length,
      clusters,
      existingStops: existing,
    });
  }

  console.log(
    `\nStop clustering (${args.apply ? "APPLY" : "DRY-RUN"}, radius=${args.radiusM}m)\n`,
  );

  let wouldWrite = 0;
  for (const plan of plans) {
    const label = `${plan.bus.label ?? plan.bus.plate_number ?? plan.bus.id} route=${plan.bus.route_id}`;
    if (plan.skip) {
      console.log(`  skip ${label}: ${plan.skip}`);
      continue;
    }
    wouldWrite += 1;
    console.log(
      `  ${label}: ${plan.points} pings → ${plan.clusters.length} stops (had ${plan.existingStops})`,
    );
    plan.clusters.forEach((c, i) => {
      console.log(
        `    ${i + 1}. ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} (n=${c.count})`,
      );
    });

    if (!args.apply) continue;

    const schoolId = plan.bus.school_id;
    const stopIds = [];
    for (let i = 0; i < plan.clusters.length; i++) {
      const c = plan.clusters[i];
      const name = `Cluster stop ${i + 1}`;
      // Prefer updating a nearby existing stop within radius; else insert.
      const { data: nearby } = await supabase
        .from("stops")
        .select("id, lat, lng, name")
        .eq("school_id", schoolId)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(200);

      let stopId = null;
      for (const s of nearby ?? []) {
        if (
          typeof s.lat === "number" &&
          typeof s.lng === "number" &&
          haversineM({ lat: s.lat, lng: s.lng }, c) <= args.radiusM
        ) {
          stopId = s.id;
          await supabase
            .from("stops")
            .update({ lat: c.lat, lng: c.lng, kind: "pickup" })
            .eq("id", s.id);
          break;
        }
      }

      if (!stopId) {
        const { data: created, error: createErr } = await supabase
          .from("stops")
          .insert({
            school_id: schoolId,
            name,
            lat: c.lat,
            lng: c.lng,
            kind: "pickup",
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        stopId = created.id;
      }
      stopIds.push(stopId);
    }

    await supabase.from("route_stops").delete().eq("route_id", plan.bus.route_id);
    const { error: rsErr } = await supabase.from("route_stops").insert(
      stopIds.map((stopId, order) => ({
        route_id: plan.bus.route_id,
        stop_id: stopId,
        stop_order: order,
        eta_offset_minutes: null,
      })),
    );
    if (rsErr) throw rsErr;
    console.log(`    wrote ${stopIds.length} route_stops`);
  }

  if (!args.apply) {
    console.log(
      `\nDry-run only (${wouldWrite} route(s) would be updated). Re-run with --apply to write.\n`,
    );
  } else {
    console.log(`\nDone. Updated ${wouldWrite} route(s).\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
