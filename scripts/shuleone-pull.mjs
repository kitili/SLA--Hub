#!/usr/bin/env node
/**
 * Pull read-only workplace data from SLA Hub into a shape ShuleOne can upsert.
 *
 * Usage:
 *   HUB_API_KEY=… npm run shuleone:pull
 *   HUB_API_KEY=… npm run shuleone:pull -- --verify
 *   HUB_API_KEY=… npm run shuleone:pull -- --since=2026-10-01T00:00:00.000Z
 *   HUB_API_KEY=… npm run shuleone:pull -- --staff --out=staff.json
 *
 * Hosts (first that answers with the key wins):
 *   1. https://hub.silverleaf.co.tz
 *   2. https://sla-hub-nu.vercel.app
 *
 * Upsert key: email (always lowercase).
 */

import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const DEFAULT_HOSTS = [
  "https://hub.silverleaf.co.tz",
  "https://sla-hub-nu.vercel.app",
];

const MIN_KEY_LENGTH = 32;

function parseArgs(argv) {
  const out = {
    verify: false,
    staff: false,
    generateKey: false,
    since: null,
    campus: null,
    app: null,
    q: null,
    limit: 200,
    out: null,
    hosts: null,
    base: null,
  };
  for (const arg of argv) {
    if (arg === "--verify") out.verify = true;
    else if (arg === "--staff") out.staff = true;
    else if (arg === "--generate-key") out.generateKey = true;
    else if (arg.startsWith("--since=")) out.since = arg.slice("--since=".length);
    else if (arg.startsWith("--campus=")) out.campus = arg.slice("--campus=".length);
    else if (arg.startsWith("--app=")) out.app = arg.slice("--app=".length);
    else if (arg.startsWith("--q=")) out.q = arg.slice("--q=".length);
    else if (arg.startsWith("--limit=")) out.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    else if (arg.startsWith("--out=")) out.out = arg.slice("--out=".length);
    else if (arg.startsWith("--hosts=")) {
      out.hosts = arg
        .slice("--hosts=".length)
        .split(",")
        .map((h) => h.trim().replace(/\/$/, ""))
        .filter(Boolean);
    } else if (arg.startsWith("--base=")) out.base = arg.slice("--base=".length).replace(/\/$/, "");
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(out.limit) || out.limit < 1) out.limit = 200;
  out.limit = Math.min(out.limit, 500);
  return out;
}

function printHelp() {
  console.log(`Pull SLA Hub people/staff for ShuleOne.

Environment:
  HUB_API_KEY   Bearer token (min ${MIN_KEY_LENGTH} chars). Same value on Hub Vercel and ShuleOne.

Options:
  --verify         Probe both hosts with /people?limit=1 and exit
  --staff          Pull /api/v1/staff instead of /people
  --since=ISO      Only rows with lastSeen/activity at or after this time
  --campus=NAME    Filter by campus
  --app=ID         Filter people by workplace app id (people only)
  --q=TEXT         Search name or email
  --limit=N        Page size (default 200, max 500)
  --out=FILE       Write JSON to FILE (default: stdout)
  --base=URL       Use a single base URL (skips dual-host probe)
  --hosts=A,B      Override host list
  --generate-key   Print a new random key and Vercel/ShuleOne setup steps
  -h, --help       Show this help
`);
}

function requireKey() {
  const key = (process.env.HUB_API_KEY || "").trim();
  if (!key || key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `HUB_API_KEY is missing or shorter than ${MIN_KEY_LENGTH} characters.\n` +
        `Generate one: npm run shuleone:pull -- --generate-key\n` +
        `Then set the same value on the Hub Vercel project and on ShuleOne.`,
    );
  }
  return key;
}

async function fetchJson(url, key) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/json",
      "user-agent": "ShuleOne-Hub-Pull/1.0",
    },
    redirect: "follow",
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { ok: false, error: text.slice(0, 200) || "Non-JSON response" };
  }
  return { status: response.status, body, url };
}

function explainFailure(results) {
  const lines = ["The key can't fetch data yet."];
  const statuses = results.map((r) => r.status);
  const errors = results.map((r) => r.body?.error || `HTTP ${r.status}`).filter(Boolean);
  if (statuses.every((s) => s === 503)) {
    lines.push("Both hosts returned HTTP 503 with Hub API is not configured. Set HUB_API_KEY.");
    lines.push("Set HUB_API_KEY on the sla-hub Vercel project (Production), redeploy, then retry.");
  } else if (statuses.every((s) => s === 401)) {
    lines.push("Both hosts returned HTTP 401 Unauthorized. The key does not match the hub.");
  } else {
    for (const result of results) {
      lines.push(`${result.url} returned ${result.status}${result.body?.error ? ` (${result.body.error})` : ""}`);
    }
  }
  if (errors.length) {
    const detail = results.find((r) => r.status >= 400);
    if (detail) lines.push(`${detail.url} returned ${detail.status}`);
  }
  return lines.join("\n");
}

async function pickHost(hosts, key) {
  const results = [];
  for (const host of hosts) {
    const probe = `${host}/api/v1/people?limit=1`;
    try {
      const result = await fetchJson(probe, key);
      results.push({ ...result, host });
      if (result.status === 200 && result.body?.ok) return { host, results };
    } catch (error) {
      results.push({
        status: 0,
        url: probe,
        host,
        body: { ok: false, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
  throw new Error(explainFailure(results));
}

async function pullAll(base, key, path, query) {
  const rows = [];
  let offset = 0;
  const limit = query.limit;
  let page = 0;
  while (true) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (query.since) params.set("since", query.since);
    if (query.campus) params.set("campus", query.campus);
    if (query.app) params.set("app", query.app);
    if (query.q) params.set("q", query.q);
    const url = `${base}${path}?${params}`;
    const result = await fetchJson(url, key);
    if (result.status !== 200 || !result.body?.ok) {
      throw new Error(
        `${url} returned ${result.status}${result.body?.error ? ` — ${result.body.error}` : ""}`,
      );
    }
    const batch = Array.isArray(result.body.data) ? result.body.data : [];
    rows.push(...batch);
    page += 1;
    if (batch.length < limit) {
      return {
        source: result.body.source || "sla-hub",
        generatedAt: result.body.generatedAt || new Date().toISOString(),
        base,
        path,
        pages: page,
        count: rows.length,
        data: rows,
      };
    }
    offset += limit;
  }
}

function printGenerateKey() {
  const key = randomBytes(32).toString("base64url");
  console.log(`# New HUB_API_KEY (${key.length} chars) — store only in secret managers\n`);
  console.log(key);
  console.log(`
# 1) Hub (Vercel → sla-hub / Production + Preview)
vercel env add HUB_API_KEY production
# paste the key, then redeploy:
vercel --prod

# 2) ShuleOne server env
HUB_API_KEY=${key}
HUB_API_BASE=https://hub.silverleaf.co.tz

# 3) Verify
HUB_API_KEY=${key} npm run shuleone:pull -- --verify
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.generateKey) {
    printGenerateKey();
    return;
  }

  const key = requireKey();
  const hosts = args.base ? [args.base] : args.hosts || DEFAULT_HOSTS;
  const { host, results } = await pickHost(hosts, key);

  if (args.verify) {
    const ok = results.find((r) => r.host === host);
    console.log(
      JSON.stringify(
        {
          ok: true,
          host,
          probed: results.map((r) => ({
            host: r.host,
            status: r.status,
            error: r.body?.error || null,
          })),
          sampleCount: ok?.body?.count ?? 0,
          message: `Hub API ready at ${host}`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const path = args.staff ? "/api/v1/staff" : "/api/v1/people";
  const payload = await pullAll(host, key, path, {
    limit: args.limit,
    since: args.since,
    campus: args.campus,
    app: args.staff ? null : args.app,
    q: args.q,
  });

  const document = {
    ok: true,
    source: payload.source,
    generatedAt: payload.generatedAt,
    host: payload.base,
    path: payload.path,
    pages: payload.pages,
    count: payload.count,
    upsertKey: "email",
    data: payload.data,
  };

  const text = `${JSON.stringify(document, null, 2)}\n`;
  if (args.out) {
    writeFileSync(args.out, text);
    console.error(`Wrote ${payload.count} rows to ${args.out} from ${payload.base}${payload.path}`);
  } else {
    process.stdout.write(text);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
