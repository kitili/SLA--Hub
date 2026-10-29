#!/usr/bin/env node
/**
 * Smoke + security checks for the Instructional Leadership Dashboard.
 *
 *   SMOKE_BASE=http://127.0.0.1:3399 node scripts/smoke-leadership.mjs
 *
 * Always runs the signed-out and bad-key checks. Add SMOKE_SESSION_SECRET with
 * SMOKE_ADMIN_ID / SMOKE_TEACHER_ID (staff ids; the cookie is forged the way
 * e2e/auth-helpers.ts does, so this only works against a server you started
 * with that SESSION_SECRET) for the signed-in checks. Add SMOKE_INGEST_KEY for
 * the authenticated ingest checks (these only send bad input and never write).
 *
 * A valid push REPLACES the stored snapshot in whatever database the server
 * uses, so it is off unless SMOKE_WRITE=1. Use it only against a throwaway
 * database; desks/lesson-plans/.env.local points at the real Academics one.
 * SMOKE_EXPECT_DB=1 means the server has a database (valid push must be 200,
 * not 503).
 */
import { createHmac } from "node:crypto";

const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:3399").replace(/\/$/, "");
const SECRET = process.env.SMOKE_SESSION_SECRET || "";
const ADMIN_ID = process.env.SMOKE_ADMIN_ID || "";
const TEACHER_ID = process.env.SMOKE_TEACHER_ID || "";
const KEY = process.env.SMOKE_INGEST_KEY || "";
const EXPECT_DB = process.env.SMOKE_EXPECT_DB === "1";
const WRITE = process.env.SMOKE_WRITE === "1";

let failures = 0;
let skipped = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`  ok    ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function skip(name, why) {
  skipped += 1;
  console.log(`  skip  ${name} (${why})`);
}

function cookie(staffId) {
  const json = Buffer.from(JSON.stringify({ staffId })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(json).digest("base64url");
  return `__sla_session=${json}.${sig}`;
}

async function req(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${BASE}${path}`, { method, headers, body, redirect: "manual" });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text, location: response.headers.get("location") || "" };
}

const payload = {
  campuses: ["Usa River"],
  terms: [{ name: "Term 1A", label: "Term 1A", start: "2026-01-12", end: "2026-03-06" }],
  pdLists: { management: ["Narrating the positive"], rigor: [] },
  walkthroughs: [],
  walkOffline: [],
  observations: [],
  obsRules: { range: { start: "", end: "" }, allowancePerTeacher: 6, teachers: {}, roster: {} },
  generatedAt: new Date().toISOString(),
  sources: [],
};
const json = { "content-type": "application/json" };

console.log(`Instructional Leadership smoke against ${BASE}`);

console.log("signed out");
let r = await req("/en/leadership");
check("page redirects to sign-in", r.status >= 300 && r.status < 400 && /\/en\/sign-in$/.test(r.location), `${r.status} ${r.location}`);
check("page leaks no dashboard markup", !r.text.includes("Instructional Leadership Dashboard"));
r = await req("/sw/leadership");
check("Swahili page redirects to its own sign-in", /\/sw\/sign-in$/.test(r.location), r.location);
r = await req("/api/leadership/data");
check("data answers 401", r.status === 401, String(r.status));
check("data is never cached", /no-store/.test(r.headers.get("cache-control") || ""));

console.log("ingest without the key");
r = await req("/api/leadership/ingest", { method: "POST", headers: json, body: JSON.stringify(payload) });
check("no key is refused (401, or 503 when the server has no key)", r.status === 401 || r.status === 503, String(r.status));
r = await req("/api/leadership/ingest", { method: "POST", headers: { ...json, authorization: "Bearer wrong-key" }, body: JSON.stringify(payload) });
check("wrong key is refused", r.status === 401 || r.status === 503, String(r.status));
r = await req("/api/leadership/ingest");
check("GET on ingest is not allowed", r.status === 405, String(r.status));
r = await req("/xx/leadership");
check("unknown locale is not served", r.status !== 200, String(r.status));

console.log("page security headers");
const headersSource = await req("/en/sign-in");
const csp = headersSource.headers.get("content-security-policy") || "";
check("CSP present, no remote scripts", csp.includes("default-src 'self'") && !/script-src[^;]*https?:/.test(csp), csp.slice(0, 80));
check("nosniff", headersSource.headers.get("x-content-type-options") === "nosniff");
check("frames limited to same origin", headersSource.headers.get("x-frame-options") === "SAMEORIGIN");

if (SECRET && ADMIN_ID && TEACHER_ID) {
  console.log("signed in");
  r = await req("/en/leadership", { headers: { cookie: cookie(TEACHER_ID) } });
  check("non-admin teacher is sent to unauthorized", /\/en\/unauthorized$/.test(r.location), `${r.status} ${r.location}`);
  r = await req("/api/leadership/data", { headers: { cookie: cookie(TEACHER_ID) } });
  check("non-admin teacher gets 403 from data", r.status === 403, String(r.status));
  r = await req("/api/leadership/ingest", { method: "POST", headers: { ...json, cookie: cookie(ADMIN_ID) }, body: JSON.stringify(payload) });
  check("an admin cookie alone cannot push data", r.status === 401 || r.status === 503, String(r.status));
  r = await req("/en/leadership", { headers: { cookie: cookie(ADMIN_ID) } });
  check("admin gets the dashboard", r.status === 200 && r.text.includes("Instructional Leadership Dashboard"), String(r.status));
  check("page is uncached and noindex", /no-store/.test(r.headers.get("cache-control") || "") && /noindex/.test(r.headers.get("x-robots-tag") || ""));
  r = await req("/api/leadership/data", { headers: { cookie: cookie(ADMIN_ID) } });
  check("admin gets JSON from data", r.status === 200 && r.headers.get("content-type")?.includes("json"), String(r.status));
  r = await req("/en", { headers: { cookie: cookie(ADMIN_ID) } });
  check("Academics home links the board", r.text.includes("/en/leadership"));
} else {
  skip("signed-in checks", "set SMOKE_SESSION_SECRET, SMOKE_ADMIN_ID, SMOKE_TEACHER_ID");
}

if (KEY) {
  console.log("ingest with the key");
  const auth = { ...json, authorization: `Bearer ${KEY}` };
  r = await req("/api/leadership/ingest", { method: "POST", headers: auth, body: "{nope" });
  check("bad JSON is 400", r.status === 400, String(r.status));
  r = await req("/api/leadership/ingest", { method: "POST", headers: auth, body: JSON.stringify({ ...payload, sources: [{ key: "x", name: "x", url: "javascript:alert(1)", updated: "" }] }) });
  check("script: link in sources is 422", r.status === 422, String(r.status));
  r = await req("/api/leadership/ingest", { method: "POST", headers: auth, body: JSON.stringify({ campuses: "no" }) });
  check("wrong shape is 422", r.status === 422, String(r.status));
  if (WRITE) {
    r = await req("/api/leadership/ingest", { method: "POST", headers: auth, body: JSON.stringify(payload) });
    check(EXPECT_DB ? "valid push is stored (200)" : "valid push reaches the database check (503 without one)", r.status === (EXPECT_DB ? 200 : 503), `${r.status} ${r.text.slice(0, 120)}`);
  } else {
    skip("valid push", "writes to the server's database; set SMOKE_WRITE=1 on a throwaway one");
  }
} else {
  skip("authenticated ingest checks", "set SMOKE_INGEST_KEY");
}

console.log(`\n${failures ? "FAILED" : "PASSED"}: ${failures} failure(s), ${skipped} skipped`);
process.exit(failures ? 1 : 0);
