#!/usr/bin/env node
/**
 * Smoke for driver Path accuracy, docs isolation, matron PWA,
 * temp stop overrides, and route-change logs.
 *
 *   node scripts/smoke-ops-fixes.mjs
 *   BASE_URL=http://localhost:3000 node scripts/smoke-ops-fixes.mjs
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

async function fetchText(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "ops-fixes-smoke/1.0", ...(init.headers ?? {}) },
    ...init,
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

function expectAuthGate(name, res, text) {
  if (res.status === 401 || res.status === 403) {
    ok(name, `status ${res.status}`);
    return;
  }
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    ok(name, `redirect ${res.status}`);
    return;
  }
  fail(name, `expected auth gate, got ${res.status} body=${text.slice(0, 100)}`);
}

async function main() {
  console.log(`Ops fixes smoke → ${BASE}\n`);

  {
    const { res, text } = await fetchText("/matron-manifest.webmanifest");
    if (res.status === 200 && /matron|start_url|Silverleaf/i.test(text)) {
      ok("matron PWA manifest", "public, no auth redirect");
    } else if ([301, 302, 303, 307, 308].includes(res.status)) {
      fail("matron PWA manifest", `auth-gated redirect ${res.status}`);
    } else {
      fail("matron PWA manifest", `status ${res.status} body=${text.slice(0, 80)}`);
    }
  }

  {
    const { res } = await fetchText("/matron");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /matron", `status ${res.status}`);
    } else {
      fail("GET /matron", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/matron/more");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /matron/more", `status ${res.status}`);
    } else {
      fail("GET /matron/more", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/driver/more");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /driver/more", `status ${res.status}`);
    } else {
      fail("GET /driver/more", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/admin/assignments");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /admin/assignments", `status ${res.status}`);
    } else {
      fail("GET /admin/assignments", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/api/driver/documents");
    expectAuthGate("GET /api/driver/documents auth", res, text);
  }

  {
    const { res, text } = await fetchText(
      "/api/trips/00000000-0000-0000-0000-000000000000/stops",
    );
    expectAuthGate("GET /api/trips/:id/stops auth", res, text);
  }

  {
    const { res, text } = await fetchText("/api/stop-overrides");
    expectAuthGate("GET /api/stop-overrides auth", res, text);
  }

  {
    const { res, text } = await fetchText("/api/route-change-logs");
    expectAuthGate("GET /api/route-change-logs auth", res, text);
  }

  {
    const { res, text } = await fetchText("/api/stop-overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expectAuthGate("POST /api/stop-overrides auth", res, text);
  }

  {
    const { res, text } = await fetchText("/api/route-change-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "smoke" }),
    });
    expectAuthGate("POST /api/route-change-logs auth", res, text);
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
