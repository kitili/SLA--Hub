#!/usr/bin/env node
/**
 * Unit checks for driver-facing helpers (no network).
 * Run: node --test scripts/test-driver-helpers.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Lightweight re-implementation of exported helpers for node:test without TS transpile.
// Keep in sync with src/lib/driver/stop-labels.ts and google-directions decode.

const KIND_LABEL = {
  school: "School",
  pickup: "Pick-up",
  dropoff: "Drop-off",
  waypoint: "Stop",
};

function stopKindLabel(kind) {
  if (!kind) return "Stop";
  return KIND_LABEL[kind] ?? "Stop";
}

function tripDirectionLabel(direction) {
  const d = (direction ?? "").toLowerCase();
  if (d === "am") return "Morning";
  if (d === "pm") return "Afternoon";
  return direction?.trim() || "Trip";
}

function isPlausibleTanzaniaCoord(lat, lng) {
  return lat >= -6 && lat <= -1 && lng >= 34 && lng <= 39;
}

function googleMapsDirectionsUrl(input) {
  const withCoords = input.stops.filter(
    (s) =>
      s.lat != null &&
      s.lng != null &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      isPlausibleTanzaniaCoord(s.lat, s.lng),
  );
  if (withCoords.length === 0) return null;
  const origin = input.origin ?? {
    lat: withCoords[0].lat,
    lng: withCoords[0].lng,
  };
  const destination = withCoords[withCoords.length - 1];
  const waypoints = withCoords.slice(
    input.origin ? 0 : 1,
    withCoords.length - 1,
  );
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((w) => `${w.lat},${w.lng}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function decodeGooglePolyline(encoded) {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  while (index < len) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    coordinates.push([lng / 1e5, lat / 1e5]);
  }
  return coordinates;
}

describe("driver stop labels", () => {
  it("never shows raw DB kinds", () => {
    assert.equal(stopKindLabel("pickup"), "Pick-up");
    assert.equal(stopKindLabel("dropoff"), "Drop-off");
    assert.equal(stopKindLabel("school"), "School");
    assert.equal(stopKindLabel("mystery"), "Stop");
  });

  it("uses Morning / Afternoon not AM/PM in UI labels", () => {
    assert.equal(tripDirectionLabel("am"), "Morning");
    assert.equal(tripDirectionLabel("pm"), "Afternoon");
  });
});

describe("google maps directions url", () => {
  it("builds a Google Maps driving URL", () => {
    const url = googleMapsDirectionsUrl({
      stops: [
        { lat: -3.37, lng: 36.68 },
        { lat: -3.38, lng: 36.69 },
      ],
      origin: { lat: -3.36, lng: 36.67 },
    });
    assert.ok(url?.startsWith("https://www.google.com/maps/dir/?"));
    assert.ok(url.includes("travelmode=driving"));
    assert.ok(url.includes("origin=-3.36%2C36.67") || url.includes("origin=-3.36,36.67"));
  });

  it("returns null when no coordinates", () => {
    assert.equal(googleMapsDirectionsUrl({ stops: [{ lat: null, lng: null }] }), null);
  });

  it("excludes implausible (non-Tanzania) coordinates", () => {
    const url = googleMapsDirectionsUrl({
      stops: [
        { lat: 40.7, lng: -74.0 }, // NYC — must not poison the path
        { lat: -3.37, lng: 36.68 },
      ],
    });
    assert.ok(url);
    assert.equal(url.includes("40.7"), false);
    assert.ok(url.includes("-3.37"));
  });
});

describe("google polyline decode", () => {
  it("decodes a known short polyline", () => {
    // Encoded polyline for a tiny segment near (38.5, -120.2)
    const coords = decodeGooglePolyline("_p~iF~ps|U");
    assert.ok(coords.length >= 1);
    assert.ok(Number.isFinite(coords[0][0]));
    assert.ok(Number.isFinite(coords[0][1]));
  });
});

describe("driver source guards", () => {
  it("MatronPathNavigate no longer offers Polyline toggle", () => {
    const src = readFileSync(
      resolve("src/components/matron/MatronPathNavigate.tsx"),
      "utf8",
    );
    assert.equal(src.includes("Polyline"), false);
    assert.equal(src.includes("lineMode"), false);
    assert.equal(src.includes("StopsMap"), false);
    assert.ok(src.includes("DriverGoogleMap"));
    assert.ok(src.includes("Navigate"));
  });

  it("geometry API uses ORS → OSRM chain (no Google on OSM map)", () => {
    const src = readFileSync(
      resolve("src/app/api/routes/geometry/route.ts"),
      "utf8",
    );
    assert.ok(src.includes("fetchOrsGeometry"));
    assert.ok(src.includes("fetchOsrmGeometry"));
    assert.ok(src.includes("fetchGeometryChain"));
    // Google Directions must stay off this OSM-tiled admin map (ToS).
    assert.equal(src.includes("fetchGoogleDirectionsGeometry"), false);
  });

  it("MatronPathNavigate uses saved-order stops API (not optimized=1)", () => {
    const src = readFileSync(
      resolve("src/components/matron/MatronPathNavigate.tsx"),
      "utf8",
    );
    assert.equal(src.includes("optimized=1"), false);
    assert.ok(src.includes("/api/trips/"));
    assert.ok(src.includes("/stops"));
    assert.ok(src.includes("Log new path"));
    assert.ok(src.includes("/api/route-change-logs"));
  });

  it("driver documents resolve only profiles.driver_id", () => {
    const src = readFileSync(
      resolve("src/app/api/driver/documents/route.ts"),
      "utf8",
    );
    assert.ok(src.includes("DRIVER_NOT_LINKED"));
    assert.ok(src.includes("profiles.driver_id"));
    assert.equal(/buses\.driver_name/.test(src), false);
    assert.equal(/full_name/.test(src), false);
  });

  it("stops API defaults to navigation stops helper", () => {
    const src = readFileSync(
      resolve("src/app/api/trips/[tripId]/stops/route.ts"),
      "utf8",
    );
    assert.ok(src.includes("getNavigationStopsForTrip"));
    assert.ok(src.includes('get("optimized") === "1"'));
  });

  it("DriverGoogleMap filters Tanzania coords", () => {
    const src = readFileSync(
      resolve("src/components/driver/DriverGoogleMap.tsx"),
      "utf8",
    );
    assert.ok(src.includes("isPlausibleTanzaniaCoord"));
  });
});
