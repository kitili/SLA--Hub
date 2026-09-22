#!/usr/bin/env node
/**
 * Catalog test case: every Silverleaf desk is wired the same way.
 * Run with `npm test`. Pair with `npm run smoke` against a running hub.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_DESKS = [
  { id: "onboarding", name: "Onboarding", port: 3000, live: "sla-onboarding-hub-steel.vercel.app" },
  { id: "talent-academy", name: "Talent Academy", port: 8765 },
  { id: "ops", name: "Ops", port: 3020, live: "ops-transport-system.vercel.app" },
  { id: "uniforms", name: "Uniforms", port: 3010, live: "school-uniforms-lyart.vercel.app" },
  { id: "marketing", name: "Marketing", port: 3180, live: "sla-marketing-web.vercel.app" },
  { id: "data-tech", name: "Data & Tech", port: 4050, live: "dataandtech.silverleaf.co.tz" },
  { id: "visitors", name: "Visitors", port: 3108, live: "v-isitors.vercel.app" },
  { id: "workboard-tasks", name: "Workboard Tasks", port: 3200, live: "silverleaf-tasks.vercel.app" },
];

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("desks.json lists every workplace desk on a unique port", () => {
  const desks = JSON.parse(read("desks.json")).desks;
  const ids = desks.map((desk) => desk.id);
  const ports = desks.map((desk) => desk.port);

  assert.deepEqual(ids, EXPECTED_DESKS.map((desk) => desk.id));
  assert.equal(new Set(ports).size, ports.length, "desk ports must be unique");
  assert.ok(!ports.includes(3100), "desk ports must not collide with the hub (3100)");

  for (const expected of EXPECTED_DESKS) {
    const desk = desks.find((item) => item.id === expected.id);
    assert.ok(desk, `missing desks.json entry ${expected.id}`);
    assert.equal(desk.port, expected.port, `${expected.id} port`);
    assert.equal(desk.name, expected.name, `${expected.id} name`);
    if (expected.live) {
      assert.match(desk.liveUrl, new RegExp(expected.live.replaceAll(".", "\\.")));
    }
  }

  const workboard = desks.find((desk) => desk.id === "workboard-tasks");
  assert.equal(workboard.repo, "https://github.com/kitili/workboard-tasks.git");
  assert.equal(workboard.path, "desks/workboard-tasks");
});

test("departments catalog includes Workboard Tasks and every other desk", () => {
  const source = read("src/lib/departments.ts");

  for (const expected of EXPECTED_DESKS) {
    assert.match(source, new RegExp(`\\| "${expected.id}"`));
    assert.match(source, new RegExp(`id: "${expected.id}"`));
    assert.match(source, new RegExp(`localPort: ${expected.port}`));
    if (expected.live) {
      assert.match(source, new RegExp(expected.live.replaceAll(".", "\\.")));
    }
  }

  assert.match(source, /WORKPLACE_WORKBOARD_TASKS_URL/);
  assert.match(source, /WORKPLACE_WORKBOARD_TASKS_LOCAL_URL/);
  assert.match(source, /Workboard Tasks/);
});

test("hosted desks stay on live sites even if laptop env points at localhost", () => {
  const source = read("src/lib/departments.ts");
  assert.match(source, /Hosted desks ignore these so a laptop \.env cannot retarget live sites/);
  assert.match(source, /const liveUrl = department\.liveUrl/);
  assert.match(source, /hosted: false/);
  assert.doesNotMatch(
    source,
    /const liveUrl = envUrl\(LIVE_ENV\[department\.id\], department\.liveUrl\)/,
  );
});

test("env example points Workboard Tasks at the live Vercel app", () => {
  const env = read(".env.example");
  assert.match(env, /WORKPLACE_WORKBOARD_TASKS_URL=https:\/\/silverleaf-tasks\.vercel\.app/);
  assert.match(env, /WORKPLACE_WORKBOARD_TASKS_LOCAL_URL=http:\/\/localhost:3200/);
});
