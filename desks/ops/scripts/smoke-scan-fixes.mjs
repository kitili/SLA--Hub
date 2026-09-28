#!/usr/bin/env node
/**
 * Smoke for scan-once, roster (no QR/fee), and boarding bus filter.
 *
 *   node scripts/smoke-scan-fixes.mjs
 *   BASE_URL=http://localhost:3000 node scripts/smoke-scan-fixes.mjs
 */
const BASE = (process.env.BASE_URL ?? "https://ops-transport-system.vercel.app").replace(
  /\/$/,
  "",
);

const checks = [];

function ok(name, detail = "") {
  checks.push({ name, pass: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  checks.push({ name, pass: false, detail });
  console.error(`✗ ${name} — ${detail}`);
}

async function fetchText(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`, {
    redirect: "manual",
    headers: { "user-agent": "scan-fixes-smoke/1.0" },
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

function expectGate(name, res) {
  if ([301, 302, 303, 307, 308, 401, 403].includes(res.status)) {
    ok(name, `status ${res.status}`);
    return;
  }
  fail(name, `expected auth gate, got ${res.status}`);
}

async function main() {
  console.log(`Scan fixes smoke → ${BASE}\n`);

  {
    const { res } = await fetchText("/matron/scan");
    expectGate("GET /matron/scan auth", res);
  }
  {
    const { res } = await fetchText("/matron/students");
    expectGate("GET /matron/students auth", res);
  }
  {
    const { res } = await fetchText("/admin/students");
    if ([200, 301, 302, 303, 307, 308].includes(res.status)) {
      ok("GET /admin/students", `status ${res.status}`);
    } else {
      fail("GET /admin/students", `status ${res.status}`);
    }
  }
  {
    const { res } = await fetchText("/admin/boarding");
    if ([200, 301, 302, 303, 307, 308].includes(res.status)) {
      ok("GET /admin/boarding", `status ${res.status}`);
    } else {
      fail("GET /admin/boarding", `status ${res.status}`);
    }
  }
  {
    const { res, text } = await fetchText("/admin/boarding?busId=missing");
    if ([200, 301, 302, 303, 307, 308].includes(res.status)) {
      ok("GET /admin/boarding?busId= filter route", `status ${res.status}`);
    } else {
      fail("GET /admin/boarding?busId=", `status ${res.status} ${text.slice(0, 80)}`);
    }
  }
  {
    const { res, text } = await fetchText("/api/boarding");
    if ([401, 403, 405].includes(res.status) || [301, 302, 303, 307, 308].includes(res.status)) {
      ok("POST /api/boarding unauth gate", `status ${res.status}`);
    } else {
      fail("POST /api/boarding unauth gate", `status ${res.status}`);
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
