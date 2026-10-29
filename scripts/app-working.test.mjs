#!/usr/bin/env node
/**
 * Catalog test case: every Silverleaf desk is wired the same way.
 * Run with `npm test`. Pair with `npm run smoke` against a running hub.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_DESKS = [
  { id: "onboarding", name: "Onboarding", port: 3000, live: "onboarding.silverleaf.co.tz" },
  { id: "talent-academy", name: "Talent Academy", port: 8765, live: "talent-academy-sla.vercel.app" },
  { id: "ops", name: "Ops", port: 3020, live: "ops-transport-system.vercel.app" },
  { id: "uniforms", name: "Uniforms", port: 3010, live: "school-uniforms-lyart.vercel.app" },
  { id: "marketing", name: "Marketing", port: 3180, live: "sla-marketing-web.vercel.app" },
  { id: "data-tech", name: "Data & Tech", port: 4050, live: "dataandtech.silverleaf.co.tz" },
  { id: "visitors", name: "Visitors", port: 3108, live: "v-isitors.vercel.app" },
  { id: "workboard-tasks", name: "1–5’s", port: 3200, live: "silverleaf-tasks.vercel.app" },
  { id: "lesson-plans", name: "Academics", port: 3300, live: "silverleaf-lesson-plans-main.vercel.app" },
  { id: "mel-dashboard", name: "MEL Dashboard", port: 3400, live: "silverleafmeldashboard-production.up.railway.app" },
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

test("departments catalog includes 1–5’s and every other desk", () => {
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
  assert.match(source, /1–5’s/);
  assert.match(source, /WORKPLACE_LESSON_PLANS_URL/);
  assert.match(source, /Academics/);
  assert.match(source, /WORKPLACE_MEL_DASHBOARD_URL/);
  assert.match(source, /MEL Dashboard/);
});

test("hosted desks stay on live sites even if laptop env points at localhost", () => {
  const source = read("src/lib/departments.ts");
  assert.match(source, /Hosted desks ignore these so a laptop \.env cannot retarget live sites/);
  assert.match(source, /const liveUrl = department\.liveUrl/);
  assert.match(source, /talent-academy-sla\.vercel\.app/);
  assert.doesNotMatch(
    source,
    /const liveUrl = envUrl\(LIVE_ENV\[department\.id\], department\.liveUrl\)/,
  );
});

test("env example points Workboard Tasks, Lesson Plans, and MEL at the live apps", () => {
  const env = read(".env.example");
  assert.match(env, /WORKPLACE_WORKBOARD_TASKS_URL=https:\/\/silverleaf-tasks\.vercel\.app/);
  assert.match(env, /WORKPLACE_WORKBOARD_TASKS_LOCAL_URL=http:\/\/localhost:3200/);
  assert.match(env, /WORKPLACE_LESSON_PLANS_URL=https:\/\/silverleaf-lesson-plans-main\.vercel\.app/);
  assert.match(env, /WORKPLACE_LESSON_PLANS_LOCAL_URL=http:\/\/localhost:3300/);
  assert.match(
    env,
    /WORKPLACE_MEL_DASHBOARD_URL=https:\/\/silverleafmeldashboard-production\.up\.railway\.app\/#overview/,
  );
  assert.match(env, /WORKPLACE_MEL_DASHBOARD_LOCAL_URL=http:\/\/localhost:3400/);
});

test("Academics lists Instructional leadership and ships its integration, tables, and security checks", () => {
  const departments = read("src/lib/departments.ts");
  assert.match(departments, /"Instructional leadership"/);

  const base = "desks/lesson-plans";
  for (const file of [
    "integrations/instructional-leadership/Code.gs",
    "integrations/instructional-leadership/Index.html",
    "integrations/instructional-leadership/PushToHub.gs",
    "db/neon/0001_instructional_leadership.sql",
    "src/app/[locale]/leadership/route.ts",
    "src/app/api/leadership/data/route.ts",
    "src/app/api/leadership/ingest/route.ts",
    "scripts/smoke-leadership.mjs",
  ]) {
    assert.ok(existsSync(join(root, base, file)), `missing ${base}/${file}`);
  }

  const sql = read(`${base}/db/neon/0001_instructional_leadership.sql`);
  for (const table of ["ild_walkthroughs", "ild_observations", "ild_config", "ild_sync_log"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  // The push key never sits in source; it is read from Script properties.
  const push = read(`${base}/integrations/instructional-leadership/PushToHub.gs`);
  assert.match(push, /getProperty\('HUB_INGEST_KEY'\)/);
  assert.doesNotMatch(push, /Bearer [A-Za-z0-9]{20,}/);

  // The ingest route checks the bearer key before it reads the body.
  const ingest = read(`${base}/src/app/api/leadership/ingest/route.ts`);
  assert.ok(ingest.indexOf("checkIngestAuth") < ingest.indexOf("request.text()"));
});
