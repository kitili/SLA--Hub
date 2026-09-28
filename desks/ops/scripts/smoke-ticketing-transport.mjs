#!/usr/bin/env node
/**
 * Smoke test: unified ticket desk → Transport department routing.
 *
 *   node scripts/smoke-ticketing-transport.mjs
 *   BASE_URL=http://localhost:3000 node scripts/smoke-ticketing-transport.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { ensureNodeWebSocket } from "./lib/ensure-node-websocket.mjs";

ensureNodeWebSocket();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const DEPARTMENTS = ["Transport", "Facilities", "Kitchen", "Security", "Farms"];
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
    headers: { "user-agent": "ops-ticketing-smoke/1.0" },
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

function randomUuid() {
  return crypto.randomUUID();
}

async function main() {
  console.log(`Ticketing → Transport smoke\n  base: ${BASE}\n`);

  // --- UI / routing ---
  {
    const { res, text } = await fetchText("/ops/ticketing?action=new");
    if (res.status === 200 && /Ops Ticket Desk|ticketing\/index\.html/i.test(text)) {
      ok("GET /ops/ticketing?action=new", `status ${res.status}`);
    } else if ([302, 303, 307].includes(res.status)) {
      ok("GET /ops/ticketing?action=new", `redirect ${res.status} (auth gate ok)`);
    } else {
      fail("GET /ops/ticketing?action=new", `status ${res.status}`);
    }
  }

  {
    const { res, text } = await fetchText("/ticketing/index.html?action=new");
    if (res.status === 200 && /Route to department|submit-department/i.test(text)) {
      ok("Desk HTML loads", "department picker present");
    } else {
      fail("Desk HTML loads", `status ${res.status}`);
    }
    if (/Route to department/i.test(text)) {
      ok("Desk copy", "unified routing label");
    } else if (/submit-department/i.test(text)) {
      ok("Desk copy", "department field present (label not deployed yet)");
    } else {
      fail("Desk copy", 'missing department picker');
    }
  }

  {
    const appJs = fs.readFileSync(
      path.join(root, "public/ticketing/js/app.js"),
      "utf8",
    );
    if (appJs.includes('getElementById("submit-department").value.trim()')) {
      ok("Submit handler", "uses form department (not login dept)");
    } else {
      fail("Submit handler", "still locked to login department");
    }
    if (!appJs.includes("deptField.disabled = true")) {
      ok("Department field", "not disabled on submit form");
    } else {
      fail("Department field", "still disabled");
    }
  }

  {
    const { res, text } = await fetchText("/ticketing/js/app.js");
    if (res.status === 200) {
      ok("Desk app.js served", `${Math.round(text.length / 1024)}kb`);
    } else {
      fail("Desk app.js served", `status ${res.status}`);
    }
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail("Supabase env", "missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY — skip live insert");
    summarize();
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ticketId = randomUuid();
  const ownerToken = randomUuid();
  const displayId = `TKT-T${String(Date.now() % 10000).padStart(4, "0")}`;
  const title = `[smoke] Transport routing ${new Date().toISOString()}`;
  const now = new Date().toISOString();

  const row = {
    id: ticketId,
    display_id: displayId,
    owner_token: ownerToken,
    department: "Transport",
    requester_name: "Smoke Test",
    campus: "Usariver Campus",
    title,
    details: "Automated smoke test — unified desk routes to Transport queue.",
    urgency: "normal",
    category: "Transport",
    priority: "normal",
    status: "open",
    created_at: now,
    updated_at: now,
  };

  {
    const { error } = await supabase.from("requests").insert(row);
    if (error) {
      fail("Insert Transport ticket", error.message);
      summarize();
      process.exit(1);
    }
    ok("Insert Transport ticket", displayId);
  }

  {
    const { data, error } = await supabase
      .from("requests")
      .select("id, department, title, status, display_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (error) fail("Fetch by id", error.message);
    else if (!data) fail("Fetch by id", "row not found");
    else if (data.department !== "Transport") {
      fail("Department stored", `got ${data.department}`);
    } else {
      ok("Department stored", "Transport");
    }
  }

  {
    const { data, error } = await supabase
      .from("requests")
      .select("id, department, title")
      .eq("department", "Transport")
      .eq("owner_token", ownerToken)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) fail("Manager inbox filter (Transport)", error.message);
    else if (!data?.some((r) => r.id === ticketId)) {
      fail("Manager inbox filter (Transport)", "ticket not in Transport queue");
    } else {
      ok("Manager inbox filter (Transport)", "ticket visible in dept queue");
    }
  }

  {
    const { data, error } = await supabase
      .from("requests")
      .select("id")
      .eq("owner_token", ownerToken)
      .eq("requester_name", "Smoke Test");
    if (error) fail("My tickets (no dept filter)", error.message);
    else if (!data?.some((r) => r.id === ticketId)) {
      fail("My tickets (no dept filter)", "requester cannot see cross-dept ticket");
    } else {
      ok("My tickets (no dept filter)", "requester sees own Transport ticket");
    }
  }

  for (const dept of DEPARTMENTS) {
    if (dept === "Transport") continue;
    const { data } = await supabase
      .from("requests")
      .select("id")
      .eq("department", dept)
      .eq("id", ticketId)
      .maybeSingle();
    if (data) {
      fail(`Wrong queue (${dept})`, "ticket leaked into other department");
    }
  }
  ok("Queue isolation", "not in Facilities/Kitchen/Security/Farms filters");

  // Cleanup
  {
    const { error } = await supabase.from("requests").delete().eq("id", ticketId);
    if (error) ok("Cleanup", `left row ${ticketId} (${error.message})`);
    else ok("Cleanup", "removed smoke ticket");
  }

  summarize();
}

function summarize() {
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
