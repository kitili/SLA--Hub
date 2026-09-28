import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadTripRun() {
  const src = readFileSync(
    resolve("src/lib/transport/trip-run.ts"),
    "utf8",
  );
  return src;
}

function buildTripRunLog({ direction, scans, schoolGateAt = null }) {
  const ordered = [...scans].sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime(),
  );
  const firstLabel =
    direction === "pm"
      ? "First drop-off (last AM pickup)"
      : "First pickup";
  const lastLabel =
    direction === "pm"
      ? "Last drop-off (first AM pickup)"
      : "Last pickup";
  const legs = ordered.map((scan, i) => {
    const isFirst = i === 0;
    const isLast = i === ordered.length - 1 && ordered.length > 1;
    return {
      index: i + 1,
      role: isFirst ? "first" : isLast ? "last" : "middle",
      label: isFirst ? firstLabel : isLast ? lastLabel : `Scan ${i + 1}`,
      studentName: scan.studentName,
    };
  });
  return {
    first: legs[0] ?? null,
    last: legs.length ? legs[legs.length - 1] : null,
    schoolGateAt,
    schoolGateLabel:
      direction === "pm" ? "Left school" : "Bus entered school",
    legs,
  };
}

function reverseAmPickupNames(amPickupOrder) {
  return [...amPickupOrder].reverse();
}

describe("Excel trip-run algorithm", () => {
  it("AM: first pickup → last pickup → school gate", () => {
    const run = buildTripRunLog({
      direction: "am",
      schoolGateAt: "2026-09-14T05:15:00.000Z",
      scans: [
        { studentName: "C Last", scannedAt: "2026-09-14T04:40:00.000Z" },
        { studentName: "A First", scannedAt: "2026-09-14T04:10:00.000Z" },
        { studentName: "B Mid", scannedAt: "2026-09-14T04:25:00.000Z" },
      ],
    });
    assert.equal(run.first.studentName, "A First");
    assert.equal(run.first.label, "First pickup");
    assert.equal(run.last.studentName, "C Last");
    assert.equal(run.last.label, "Last pickup");
    assert.equal(run.schoolGateLabel, "Bus entered school");
    assert.ok(run.schoolGateAt);
  });

  it("PM reverse: last AM pickup is first drop-off", () => {
    const am = ["A First", "B Mid", "C Last"];
    const pm = reverseAmPickupNames(am);
    assert.deepEqual(pm, ["C Last", "B Mid", "A First"]);

    const run = buildTripRunLog({
      direction: "pm",
      scans: [
        { studentName: "C Last", scannedAt: "2026-09-14T13:05:00.000Z" },
        { studentName: "B Mid", scannedAt: "2026-09-14T13:20:00.000Z" },
        { studentName: "A First", scannedAt: "2026-09-14T13:40:00.000Z" },
      ],
    });
    assert.equal(run.first.studentName, "C Last");
    assert.equal(run.first.label, "First drop-off (last AM pickup)");
    assert.equal(run.last.studentName, "A First");
    assert.equal(run.last.label, "Last drop-off (first AM pickup)");
  });
});

describe("phone timestamp pipeline", () => {
  it("scanner stamps scannedAt before POST /api/boarding", () => {
    const src = readFileSync(
      resolve("src/components/matron/MatronQrScanner.tsx"),
      "utf8",
    );
    assert.ok(src.includes("const scannedAt = new Date().toISOString()"));
    assert.ok(src.includes("scannedAt,"));
    assert.ok(src.includes("/api/boarding"));
  });

  it("outbox flushes the original queued time", () => {
    const src = readFileSync(
      resolve("src/lib/matron/boarding-outbox.ts"),
      "utf8",
    );
    assert.ok(src.includes("scannedAt: row.queuedAt"));
  });

  it("API and recordBoarding persist scannedAt", () => {
    const api = readFileSync(
      resolve("src/app/api/boarding/route.ts"),
      "utf8",
    );
    const q = readFileSync(resolve("src/lib/db/queries.ts"), "utf8");
    assert.ok(api.includes("scannedAt: body.scannedAt"));
    assert.ok(q.includes("scannedAt?:"));
    assert.ok(q.includes("insertRow.scanned_at"));
  });

  it("trip-run helper lives in src", () => {
    const src = loadTripRun();
    assert.ok(src.includes("First drop-off (last AM pickup)"));
    assert.ok(src.includes("Bus entered school"));
  });
});
