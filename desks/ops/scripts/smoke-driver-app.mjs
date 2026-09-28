#!/usr/bin/env node
/**
 * Driver app smoke test against a running deployment (default: production).
 *
 *   node scripts/smoke-driver-app.mjs
 *   BASE_URL=http://localhost:3001 node scripts/smoke-driver-app.mjs
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

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "ops-driver-smoke/1.0" },
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

async function main() {
  console.log(`Matron field-app smoke → ${BASE}\n`);

  {
    const { res, text } = await fetchText("/get-driver");
    if (res.status === 200 && /Download Matron app|Matron app/i.test(text)) {
      ok("GET /get-driver", `status ${res.status}`);
    } else {
      fail("GET /get-driver", `status ${res.status}`);
    }
    if (/Polyline/i.test(text)) {
      fail("get-driver copy", "still mentions Polyline");
    } else {
      ok("get-driver copy", "no Polyline jargon");
    }
  }

  {
    const { res } = await fetchText("/downloads/sl-driver.apk");
    if (res.status === 200 || res.status === 302 || res.status === 301) {
      ok("APK download route", `status ${res.status}`);
    } else {
      fail("APK download route", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/driver");
    const loc = res.headers.get("location") ?? "";
    if ([302, 303, 307, 308].includes(res.status) && loc.includes("/matron")) {
      ok("GET /driver legacy redirect", `→ ${loc.slice(0, 80)}`);
    } else if (res.status === 307 || res.status === 302 || res.status === 303) {
      ok("GET /driver auth gate", `redirect ${loc.slice(0, 80)}`);
    } else {
      fail("GET /driver legacy redirect", `status ${res.status} loc=${loc.slice(0, 60)}`);
    }
  }

  {
    const { res } = await fetchText("/driver/path");
    const loc = res.headers.get("location") ?? "";
    if ([302, 303, 307, 308].includes(res.status) && loc.includes("/matron/path")) {
      ok("GET /driver/path legacy redirect", `→ ${loc.slice(0, 80)}`);
    } else if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /driver/path", `status ${res.status}`);
    } else {
      fail("GET /driver/path", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/matron/path");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /matron/path", `status ${res.status}`);
    } else {
      fail("GET /matron/path", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/api/trips");
    if (res.status === 401 || res.status === 403) {
      ok("GET /api/trips requires auth", `status ${res.status}`);
    } else {
      fail("GET /api/trips requires auth", `status ${res.status} body=${text.slice(0, 80)}`);
    }
  }

  {
    const { res } = await fetchText("/api/routes/geometry");
    if (res.status === 401 || res.status === 403 || res.status === 405) {
      ok("geometry API not public", `status ${res.status}`);
    } else {
      fail("geometry API not public", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/driver-manifest.webmanifest");
    const loc = res.headers.get("location") ?? "";
    if (res.status === 200 && /matron|start_url|Silverleaf/i.test(text)) {
      ok("legacy driver PWA manifest", "serves matron app");
    } else if (
      [301, 302, 303, 307, 308].includes(res.status) &&
      /matron-manifest/i.test(loc)
    ) {
      ok("legacy driver PWA manifest", `redirect ${loc.slice(0, 80)}`);
    } else if ([301, 302, 303, 307, 308].includes(res.status)) {
      fail("legacy driver PWA manifest", `unexpected redirect ${res.status} ${loc.slice(0, 60)}`);
    } else {
      fail("legacy driver PWA manifest", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/api/driver/documents");
    if (res.status === 401 || res.status === 403) {
      ok("driver documents API requires auth", `status ${res.status}`);
    } else {
      fail(
        "driver documents API requires auth",
        `status ${res.status} body=${text.slice(0, 80)}`,
      );
    }
  }

  {
    const { res } = await fetchText("/driver/navigate");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /driver/navigate", `status ${res.status}`);
    } else {
      fail("GET /driver/navigate", `status ${res.status}`);
    }
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
