import test from "node:test";
import assert from "node:assert/strict";

/** Mirror of src/lib/routing/stop-order.ts for unit tests (no TS import). */
function orderedStopsForDirection(stops, direction) {
  const sorted = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  if (direction !== "pm") return sorted;
  return sorted.reverse().map((stop, index) => ({ ...stop, stop_order: index + 1 }));
}

test("AM keeps pickup → school order", () => {
  const stops = [
    { stop_id: "a", stop_order: 1, name: "School" },
    { stop_id: "b", stop_order: 2, name: "Ngaramtoni" },
    { stop_id: "c", stop_order: 3, name: "Tengeru" },
  ];
  const am = orderedStopsForDirection(stops, "am");
  assert.deepEqual(
    am.map((s) => s.name),
    ["School", "Ngaramtoni", "Tengeru"],
  );
});

test("PM reverses — last pickup becomes first", () => {
  const stops = [
    { stop_id: "a", stop_order: 1, name: "School" },
    { stop_id: "b", stop_order: 2, name: "Ngaramtoni" },
    { stop_id: "c", stop_order: 3, name: "Tengeru" },
  ];
  const pm = orderedStopsForDirection(stops, "pm");
  assert.deepEqual(
    pm.map((s) => s.name),
    ["Tengeru", "Ngaramtoni", "School"],
  );
  assert.equal(pm[0].stop_order, 1);
  assert.equal(pm[2].stop_order, 3);
});
