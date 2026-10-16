#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const puller = readFileSync(join(root, "scripts/shuleone-pull.mjs"), "utf8");
const docs = readFileSync(join(root, "docs/SLA-HUB-API.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const auth = readFileSync(join(root, "src/lib/hub-api/auth.ts"), "utf8");
const health = readFileSync(join(root, "src/app/api/health/route.ts"), "utf8");
const people = readFileSync(join(root, "src/app/api/v1/people/route.ts"), "utf8");

test("shuleone puller probes both production hosts and upserts on email", () => {
  assert.match(puller, /hub\.silverleaf\.co\.tz/);
  assert.match(puller, /sla-hub-nu\.vercel\.app/);
  assert.match(puller, /upsertKey: "email"/);
  assert.match(puller, /--verify/);
  assert.match(puller, /--generate-key/);
  assert.match(puller, /Both hosts returned HTTP 503/);
  assert.match(puller, /Set HUB_API_KEY/);
});

test("package.json exposes shuleone pull and hub-api smoke scripts", () => {
  assert.equal(pkg.scripts["shuleone:pull"], "node scripts/shuleone-pull.mjs");
  assert.equal(pkg.scripts["hub-api:smoke"], "node scripts/hub-api-smoke.mjs");
  assert.equal(pkg.scripts["hub-api:verify"], "node scripts/verify-hub-api.mjs");
  assert.match(pkg.scripts.test, /shuleone-pull\.test\.mjs/);
});

test("hub API auth and health advertise configuration without leaking the key", () => {
  assert.match(auth, /export function isHubApiConfigured/);
  assert.match(health, /hubApi: isHubApiConfigured\(\)/);
  assert.doesNotMatch(health, /HUB_API_KEY\}/);
});

test("people API uses the strict listing so DB failures become 502", () => {
  assert.match(people, /listWorkplacePeopleStrict/);
  assert.doesNotMatch(people, /listWorkplacePeople\(/);
});

test("SLA-HUB-API docs list hub.silverleaf.co.tz and the puller", () => {
  assert.match(docs, /https:\/\/hub\.silverleaf\.co\.tz/);
  assert.match(docs, /npm run shuleone:pull/);
  assert.match(docs, /--verify/);
  assert.match(docs, /HUB_API_KEY/);
});
