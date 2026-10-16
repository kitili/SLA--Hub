#!/usr/bin/env node
/**
 * Smoke /api/v1 for ShuleOne. Needs a running hub and HUB_API_KEY.
 *
 *   HUB_API_KEY=… SMOKE_BASE=http://127.0.0.1:3100 npm run hub-api:smoke
 */

const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const KEY = (process.env.HUB_API_KEY || "").trim();
const MIN_KEY_LENGTH = 32;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function req(path, { key, expectStatus } = {}) {
  const headers = { accept: "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const response = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (expectStatus != null) {
    assert(response.status === expectStatus, `${path} expected ${expectStatus}, got ${response.status}`);
  }
  return { status: response.status, body, text };
}

async function main() {
  assert(KEY.length >= MIN_KEY_LENGTH, `Set HUB_API_KEY (≥${MIN_KEY_LENGTH} chars) before hub-api:smoke`);

  const checks = [];

  const health = await req("/api/health", { expectStatus: 200 });
  assert(health.body?.status === "ok", "/api/health missing status ok");
  assert(health.body?.hubApi === true, "/api/health.hubApi should be true when HUB_API_KEY is set");
  checks.push("health hubApi");

  await req("/api/v1", { expectStatus: 401 });
  checks.push("catalog rejects missing key");

  await req("/api/v1", { key: "x".repeat(40), expectStatus: 401 });
  checks.push("catalog rejects wrong key");

  const catalog = await req("/api/v1", { key: KEY, expectStatus: 200 });
  assert(catalog.body?.ok === true, "catalog not ok");
  assert(Array.isArray(catalog.body?.endpoints), "catalog missing endpoints");
  checks.push("catalog");

  const people = await req("/api/v1/people?limit=2", { key: KEY, expectStatus: 200 });
  assert(people.body?.ok === true, "people not ok");
  assert(Array.isArray(people.body?.data), "people missing data");
  checks.push("people");

  const staff = await req("/api/v1/staff?limit=2", { key: KEY, expectStatus: 200 });
  assert(staff.body?.ok === true, "staff not ok");
  checks.push("staff");

  const campuses = await req("/api/v1/campuses", { key: KEY, expectStatus: 200 });
  assert(campuses.body?.ok === true, "campuses not ok");
  checks.push("campuses");

  const systems = await req("/api/v1/systems", { key: KEY, expectStatus: 200 });
  assert(systems.body?.ok === true, "systems not ok");
  checks.push("systems");

  for (const path of ["/api/v1/journey", "/api/v1/hiring", "/api/v1/tickets", "/api/v1/catalog"]) {
    const feed = await req(path, { key: KEY, expectStatus: 200 });
    assert(feed.body?.ok === true, `${path} not ok`);
    checks.push(path);
  }
  const hiring = await req("/api/v1/hiring", { key: KEY, expectStatus: 200 });
  assert(Array.isArray(hiring.body?.stages) && hiring.body.stages.length >= 10, "hiring stages missing");
  checks.push("hiring stages");

  console.log(`hub-api smoke ok  ${BASE}`);
  for (const name of checks) console.log(`  pass  ${name}`);
}

main().catch((error) => {
  console.error(`hub-api smoke failed: ${error.message}`);
  process.exit(1);
});
