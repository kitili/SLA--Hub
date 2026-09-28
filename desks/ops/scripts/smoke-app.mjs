#!/usr/bin/env node
/**
 * App smoke test — core routes, unified ticketing, driver surface.
 *
 *   node scripts/smoke-app.mjs
 *   BASE_URL=http://localhost:3000 node scripts/smoke-app.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    headers: { "user-agent": "ops-app-smoke/1.0" },
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      env: { ...process.env, BASE_URL: BASE },
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  console.log(`App smoke → ${BASE}\n`);

  {
    const { res, text } = await fetchText("/");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET / (login)", `status ${res.status}`);
    } else {
      fail("GET / (login)", `status ${res.status}`);
    }
    if (res.status === 200 && /Sign In|Silverleaf/i.test(text)) {
      ok("Login page", "renders");
    }
  }

  {
    const { res } = await fetchText("/ops");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /ops", `status ${res.status} (auth gate ok)`);
    } else {
      fail("GET /ops", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/ticketing/index.html");
    if (res.status === 200 && /Ops Ticket Desk|Route to department/i.test(text)) {
      ok("Ticket desk static", "loads");
    } else if (res.status === 200 && /submit-department/i.test(text)) {
      ok("Ticket desk static", "loads (legacy label)");
    } else {
      fail("Ticket desk static", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/transport");
    if ([200, 302, 303, 307].includes(res.status)) {
      ok("GET /transport", `status ${res.status}`);
    } else {
      fail("GET /transport", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/admin/dashboard/ceo");
    if (res.status === 404) {
      ok("CEO view removed", "404");
    } else if ([302, 303, 307].includes(res.status)) {
      ok("CEO view removed", `redirect ${res.status}`);
    } else if (res.status === 200) {
      fail("CEO view removed", "still returns 200");
    } else {
      ok("CEO view removed", `status ${res.status}`);
    }
  }

  {
    const { res } = await fetchText("/ops/admin");
    // Unauthenticated users are redirected to login; authenticated admin gets 200.
    if ([302, 303, 307].includes(res.status) || res.status === 200) {
      ok("Command center route", `status ${res.status}`);
    } else if (res.status === 404) {
      fail("Command center route", "404 — /ops/admin missing");
    } else {
      ok("Command center route", `status ${res.status}`);
    }
  }

  console.log("\n— nested: transport ticketing —");
  try {
    await runScript("smoke-ticketing-transport.mjs");
    ok("Transport ticketing smoke", "passed");
  } catch (err) {
    fail("Transport ticketing smoke", err.message);
  }

  console.log("\n— nested: driver surface —");
  try {
    await runScript("smoke-driver-app.mjs");
    ok("Driver smoke", "passed");
  } catch (err) {
    fail("Driver smoke", err.message);
  }

  console.log("\n— nested: scan once / roster —");
  try {
    await runScript("smoke-scan-fixes.mjs");
    ok("Scan fixes smoke", "passed");
  } catch (err) {
    fail("Scan fixes smoke", err.message);
  }

  console.log("\n— nested: ops path/docs/matron fixes —");
  try {
    await runScript("smoke-ops-fixes.mjs");
    ok("Ops fixes smoke", "passed");
  } catch (err) {
    fail("Ops fixes smoke", err.message);
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
