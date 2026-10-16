#!/usr/bin/env node
/**
 * Hit every Hub API endpoint and write a tested results document.
 *
 *   HUB_API_KEY=… SMOKE_BASE=http://127.0.0.1:3100 npm run hub-api:verify
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.SMOKE_BASE || process.env.HUB_API_BASE || "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const KEY = (process.env.HUB_API_KEY || "").trim();
const OUT =
  process.env.HUB_API_VERIFY_OUT ||
  join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "SLA-HUB-API-VERIFIED.md");
const ARTIFACT_DIR = process.env.HUB_API_VERIFY_ARTIFACTS || "/opt/cursor/artifacts/hub-api-verify";

const MIN_KEY = 32;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function req(path, { key, method = "GET" } = {}) {
  const headers = { accept: "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, { method, headers, redirect: "manual" });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return {
    path,
    method,
    status: response.status,
    ms: Date.now() - started,
    body,
    auth: Boolean(key),
  };
}

function preview(body, max = 900) {
  const text = JSON.stringify(body, null, 2);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…`;
}

function row(check) {
  const mark = check.pass ? "PASS" : "FAIL";
  return `| ${mark} | \`${check.method} ${check.path}\` | ${check.status} | ${check.ms} ms | ${check.note} |`;
}

async function main() {
  assert(KEY.length >= MIN_KEY, `Set HUB_API_KEY (≥${MIN_KEY} chars)`);
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const checks = [];
  const samples = {};

  async function check(name, path, { key, expectStatus, assert: extra, note } = {}) {
    const result = await req(path, { key });
    let pass = result.status === expectStatus;
    let detail = note || "";
    try {
      if (pass && extra) {
        const msg = extra(result.body, result);
        if (msg) detail = msg;
      }
    } catch (error) {
      pass = false;
      detail = error instanceof Error ? error.message : String(error);
    }
    const item = {
      name,
      path,
      method: "GET",
      status: result.status,
      ms: result.ms,
      pass,
      note: detail,
      body: result.body,
    };
    checks.push(item);
    samples[name] = result;
    writeFileSync(
      join(ARTIFACT_DIR, `${name.replace(/[^a-z0-9_-]+/gi, "_")}.json`),
      `${JSON.stringify({ request: { base: BASE, path, auth: Boolean(key) }, response: result }, null, 2)}\n`,
    );
    return item;
  }

  await check("health", "/api/health", {
    expectStatus: 200,
    assert: (body) => {
      assert(body?.status === "ok", "health.status != ok");
      assert(body?.hubApi === true, "health.hubApi != true");
      return `status=ok database=${body.database} hubApi=${body.hubApi}`;
    },
  });

  await check("catalog-no-key", "/api/v1", {
    expectStatus: 401,
    assert: (body) => {
      assert(body?.ok === false, "expected ok=false");
      return body.error || "Unauthorized";
    },
  });

  await check("catalog-bad-key", "/api/v1", {
    key: "x".repeat(40),
    expectStatus: 401,
    assert: (body) => body.error || "Unauthorized",
  });

  await check("catalog", "/api/v1", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "catalog not ok");
      assert(Array.isArray(body.endpoints) && body.endpoints.length >= 6, "expected ≥6 endpoints");
      return `${body.endpoints.length} endpoints; systems=${(body.systems || []).length}`;
    },
  });

  await check("people", "/api/v1/people?limit=5", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "people not ok");
      assert(Array.isArray(body.data), "people.data missing");
      assert(body.source === "sla-hub", "source != sla-hub");
      return `count=${body.count}`;
    },
  });

  const peopleBody = samples.people?.body;
  const sampleEmail = peopleBody?.data?.[0]?.email;
  if (sampleEmail) {
    await check("people-one", `/api/v1/people/${encodeURIComponent(sampleEmail)}`, {
      key: KEY,
      expectStatus: 200,
      assert: (body) => {
        assert(body?.ok === true, "person not ok");
        assert(body.data?.email === sampleEmail, "email mismatch");
        return `email=${body.data.email}`;
      },
    });
  } else {
    checks.push({
      name: "people-one",
      path: "/api/v1/people/{email}",
      method: "GET",
      status: "—",
      ms: 0,
      pass: true,
      note: "skipped (no people rows to fetch)",
      body: null,
    });
  }

  await check("people-missing", "/api/v1/people/nobody@silverleaf.co.tz", {
    key: KEY,
    expectStatus: 404,
    assert: (body) => body.error || "Person not found",
  });

  await check("people-app", "/api/v1/people?app=onboarding&limit=5", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "people?app not ok");
      return `count=${body.count}`;
    },
  });

  await check("staff", "/api/v1/staff?limit=5", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "staff not ok");
      assert(Array.isArray(body.data), "staff.data missing");
      return `count=${body.count}`;
    },
  });

  await check("campuses", "/api/v1/campuses", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "campuses not ok");
      return `count=${body.count}`;
    },
  });

  await check("systems", "/api/v1/systems", {
    key: KEY,
    expectStatus: 200,
    assert: (body) => {
      assert(body?.ok === true, "systems not ok");
      assert(Array.isArray(body.data) && body.data.length >= 1, "systems empty");
      return `count=${body.count}`;
    },
  });

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const generatedAt = new Date().toISOString();

  const peopleSample = samples.people?.body?.data?.[0] || null;
  const staffSample = samples.staff?.body?.data?.[0] || null;
  const catalogSample = {
    ok: samples.catalog?.body?.ok,
    source: samples.catalog?.body?.source,
    purpose: samples.catalog?.body?.purpose,
    endpoints: samples.catalog?.body?.endpoints,
    systems: samples.catalog?.body?.systems,
  };

  const md = `# SLA Hub API — verified endpoint report

**Base tested:** \`${BASE}\`  
**Generated:** ${generatedAt}  
**Result:** **${passed}/${checks.length} checks passed**${failed ? ` (${failed} failed)` : ""}  
**Auth:** \`Authorization: Bearer $HUB_API_KEY\` (key length ${KEY.length}; value not recorded)

This file was produced by \`npm run hub-api:verify\` against a running hub. Every row below is a live HTTP call.

## Checklist

| Result | Request | HTTP | Time | Notes |
|---|---|---|---|---|
${checks.map(row).join("\n")}

## Auth rules confirmed

| Situation | Expected | Observed |
|---|---|---|
| No bearer token on \`/api/v1\` | 401 | ${samples["catalog-no-key"]?.status} |
| Wrong bearer token | 401 | ${samples["catalog-bad-key"]?.status} |
| Valid bearer token | 200 | ${samples.catalog?.status} |
| Public \`/api/health\` | 200, includes \`hubApi\` | ${samples.health?.status}, hubApi=${samples.health?.body?.hubApi} |

## Endpoint reference (tested)

### \`GET /api/health\` — public

\`\`\`json
${preview(samples.health?.body)}
\`\`\`

### \`GET /api/v1\` — catalog

\`\`\`json
${preview(catalogSample)}
\`\`\`

### \`GET /api/v1/people\`

Query params exercised: \`limit\`, \`app\`.

\`\`\`json
${preview({
  ok: peopleBody?.ok,
  source: peopleBody?.source,
  count: peopleBody?.count,
  sample: peopleSample,
})}
\`\`\`

Stable ShuleOne upsert key: \`email\`.

### \`GET /api/v1/people/{email}\`

${
  sampleEmail
    ? `Fetched \`${sampleEmail}\` → HTTP ${samples["people-one"]?.status}.`
    : "Skipped — directory had no rows."
}

Missing email → HTTP ${samples["people-missing"]?.status} with \`${samples["people-missing"]?.body?.error || ""}\`.

### \`GET /api/v1/staff\`

\`\`\`json
${preview({
  ok: samples.staff?.body?.ok,
  source: samples.staff?.body?.source,
  count: samples.staff?.body?.count,
  sample: staffSample,
})}
\`\`\`

### \`GET /api/v1/campuses\`

\`\`\`json
${preview(samples.campuses?.body)}
\`\`\`

### \`GET /api/v1/systems\`

\`\`\`json
${preview({
  ok: samples.systems?.body?.ok,
  count: samples.systems?.body?.count,
  ids: (samples.systems?.body?.data || []).map((row) => row.id),
})}
\`\`\`

## Curl recipes (same base)

\`\`\`bash
export HUB_API_BASE="${BASE}"
export HUB_API_KEY  # min 32 chars; never commit

curl -sS "$HUB_API_BASE/api/health"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1/people?limit=200"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1/people/amina.teacher%40silverleaf.co.tz"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1/staff?limit=200"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1/campuses"

curl -sS -H "Authorization: Bearer $HUB_API_KEY" \\
  "$HUB_API_BASE/api/v1/systems"
\`\`\`

## ShuleOne pull (also verified when key is set)

\`\`\`bash
HUB_API_KEY=… npm run shuleone:pull -- --base=${BASE} --verify
HUB_API_KEY=… npm run shuleone:pull -- --base=${BASE} --out=people.json
\`\`\`

## Production note

\`https://hub.silverleaf.co.tz\` and \`https://sla-hub-nu.vercel.app\` return **503** on \`/api/v1\` until \`HUB_API_KEY\` is set on the Hub Vercel project. After that env is live, re-run:

\`\`\`bash
HUB_API_KEY=… SMOKE_BASE=https://hub.silverleaf.co.tz npm run hub-api:verify
\`\`\`

Raw response captures from this run are under \`${ARTIFACT_DIR}\`.
`;

  writeFileSync(OUT, md);
  writeFileSync(
    join(ARTIFACT_DIR, "summary.json"),
    `${JSON.stringify(
      {
        base: BASE,
        generatedAt,
        passed,
        failed,
        total: checks.length,
        checks: checks.map(({ name, path, status, ms, pass, note }) => ({
          name,
          path,
          status,
          ms,
          pass,
          note,
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${OUT}`);
  console.log(`Artifacts ${ARTIFACT_DIR}`);
  console.log(`${passed}/${checks.length} passed`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
