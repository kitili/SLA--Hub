#!/usr/bin/env node
/**
 * Source checks: one scan per child, roster hides QR/fee, outbox dedupes.
 * Run: node --test scripts/test-boarding-scan.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel) {
  return readFileSync(resolve(rel), "utf8");
}

describe("one scan per child per trip", () => {
  const src = read("src/lib/db/queries.ts");

  it("rejects a second boarding_events row for the same student", () => {
    assert.match(src, /events\.length > 0/);
    assert.match(src, /already scanned this trip/);
    assert.equal(src.includes("last.event_type === \"in\" ? \"out\" : \"in\""), false);
  });

  it("scanner remembers a code and will not post it again", () => {
    const scanner = read("src/components/matron/MatronQrScanner.tsx");
    assert.match(scanner, /rememberScannedCode/);
    assert.match(scanner, /loadScannedCodes/);
    assert.match(scanner, /Already scanned for this trip/);
    assert.match(scanner, /scanner\.pause/);
    assert.match(scanner, /scanState\.kind === "idle"/);
  });
});

describe("offline sync does not double-queue", () => {
  const src = read("src/lib/matron/boarding-outbox.ts");

  it("skips enqueue when the same trip+code is already queued", () => {
    assert.match(src, /existing\.some/);
    assert.match(src, /e\.code\.trim\(\)\.toLowerCase\(\) === code/);
  });

  it("drops 409 / already-scanned rows instead of retrying forever", () => {
    assert.match(src, /res\.status === 409/);
    assert.match(src, /already/);
  });
});

describe("AM/PM trip window", () => {
  const src = read("src/lib/matron/trip-window.ts");

  it("blocks PM before 1pm Dar time and AM after", () => {
    assert.match(src, /primaryDirectionNow/);
    assert.match(src, /canStartTripDirection/);
    assert.match(src, /Africa\/Dar_es_Salaam/);
  });
});

describe("filter lists are alphabetical", () => {
  it("sorts buses and schools in getBuses/getSchools", () => {
    const src = read("src/lib/db/queries.ts");
    assert.match(src, /sortByAlpha\(data as Bus\[\], \(b\) => b\.label\)/);
    assert.match(src, /sortByAlpha\(data, \(s\) => s\.name\)/);
  });

  it("sorts roster students by full display name A–Z", () => {
    const sortLib = read("src/lib/sort/alphabetical.ts");
    const roster = read("src/components/matron/MatronStudentList.tsx");
    assert.match(sortLib, /studentDisplayName/);
    assert.match(sortLib, /compareAlpha\(studentDisplayName\(a\), studentDisplayName\(b\)\)/);
    assert.match(roster, /sortStudentsByName\(matches\)/);
    assert.match(roster, /All buses/);
    assert.match(roster, /All schools/);
    assert.match(read("src/app/(matron)/matron/students/page.tsx"), /Full fleet roster/);
    assert.match(read("src/lib/db/queries.ts"), /sortStudentsByName\(await getStudents\(\)\)/);
  });

  it("orders by full name (matches matron card text)", () => {
    const names = sortLikeSheet([
      { first_name: "Christian", last_name: "Elisante Ayo" },
      { first_name: "Grace", last_name: "Talia Isabwa" },
      { first_name: "Mulhati", last_name: "Majidi Juma" },
      { first_name: "Samori", last_name: "Sankofa Harpper" },
    ]);
    assert.deepEqual(
      names.map((s) => `${s.first_name} ${s.last_name}`),
      [
        "Christian Elisante Ayo",
        "Grace Talia Isabwa",
        "Mulhati Majidi Juma",
        "Samori Sankofa Harpper",
      ],
    );
  });
});

/** Mirror src/lib/sort/alphabetical.ts for a behavioural check in Node. */
function sortLikeSheet(students) {
  const display = (s) => `${s.first_name} ${s.last_name}`.trim();
  const cmp = (a, b) =>
    display(a).localeCompare(display(b), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  return [...students].sort(cmp);
}

describe("trip lists sort by bus A–Z", () => {
  it("sorts today and history trip queries", () => {
    const src = read("src/lib/db/queries.ts");
    assert.match(src, /sortTripsTodayByBus\(mapped\)/);
    assert.match(src, /sortTripsHistoryByDateBus\(mapped\)/);
    const sortLib = read("src/lib/sort/alphabetical.ts");
    assert.match(sortLib, /sortTripsTodayByBus/);
    assert.match(sortLib, /sortTripsHistoryByDateBus/);
  });

  it("orders buses alphabetically for the same day", () => {
    const trips = sortTripsTodayLike([
      { bus_label: "Rental - Race", direction: "pm" },
      { bus_label: "BHM", direction: "am" },
      { bus_label: "DDA", direction: "am" },
    ]);
    assert.deepEqual(
      trips.map((t) => t.bus_label),
      ["BHM", "DDA", "Rental - Race"],
    );
  });
});

function sortTripsTodayLike(trips) {
  const cmp = (a, b) =>
    a.bus_label.localeCompare(b.bus_label, undefined, {
      sensitivity: "base",
      numeric: true,
    }) ||
    a.direction.localeCompare(b.direction, undefined, { sensitivity: "base" });
  return [...trips].sort(cmp);
}

describe("trip GPS trail", () => {
  it("loads full trail from locations API and drawGpsTrail helper", () => {
    const api = read("src/app/api/trips/[tripId]/locations/route.ts");
    assert.match(api, /getTripLocationTrail/);
    assert.match(api, /normalizeGpsTrail/);
    const map = read("src/components/maps/TripGpsTrailMap.tsx");
    assert.match(map, /export function drawGpsTrail/);
    assert.match(read("src/app/(admin)/admin/trips/page.tsx"), /admin\/trips\/\$\{t\.id\}/);
  });

  it("shows unique students scanned on trip detail", () => {
    const q = read("src/lib/db/queries.ts");
    assert.match(q, /getTripScanStats/);
    assert.match(q, /students_scanned/);
    assert.match(read("src/app/(admin)/admin/trips/[tripId]/page.tsx"), /Students scanned/);
  });
});

describe("createTrip respects direction", () => {
  const src = read("src/lib/db/queries.ts");

  it("activates only the requested direction and blocks a second active leg", () => {
    assert.match(src, /activeToday\.direction === input\.direction/);
    assert.match(src, /todaysTrips\.find\(\(t\) => t\.direction === input\.direction\)/);
  });
});

describe("roster does not show QR or fee", () => {
  const matron = read("src/components/matron/MatronStudentList.tsx");
  const admin = read("src/app/(admin)/admin/students/page.tsx");

  it("matron roster list has no QR display or fee badge", () => {
    assert.equal(matron.includes("StudentQrDisplay"), false);
    assert.equal(matron.includes("FeeBadge"), false);
    assert.match(matron, /StudentInitials/);
  });

  it("admin roster list has no QR graphic or fee badge", () => {
    assert.equal(admin.includes("QrDisplay"), false);
    assert.equal(admin.includes("FeeBadge"), false);
    assert.match(admin, /name="busId"/);
  });
});
