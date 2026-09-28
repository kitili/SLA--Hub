#!/usr/bin/env node
/**
 * Copy auth env vars from onboarding .env.local into this Vercel project.
 * Usage (from repo root, after `vercel link`):
 *   node scripts/sync-vercel-auth-env.mjs
 *   node scripts/sync-vercel-auth-env.mjs ../silverleaf-onboarding-hub/.env.local
 *
 * Never commits secrets. Skips local-only keys (mock ed-admin URL, dev fallback).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEYS = [
  "SESSION_SECRET",
  "ED_ADMIN_API_TOKEN",
  "HR_ADMIN_EMAILS",
  "ADMIN_PASSWORDS",
  "ADMIN_PIN",
];

const SKIP = new Set([
  "ED_ADMIN_STAFF_API_URL",
  "ADMIN_ALLOW_LOCAL_DIRECTORY_FALLBACK",
]);

const sourcePath =
  process.argv[2] ??
  resolve(import.meta.dirname, "../../../silverleaf-onboarding-hub/.env.local");

const text = readFileSync(sourcePath, "utf8");
const vars = new Map();
for (const line of text.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (SKIP.has(key)) continue;
  vars.set(key, val);
}

for (const key of KEYS) {
  const val = vars.get(key);
  if (!val) {
    console.warn(`[skip] ${key} not found in ${sourcePath}`);
    continue;
  }
  for (const envName of ["production", "preview", "development"]) {
    execFileSync(
      "npx",
      ["vercel", "env", "add", key, envName, "--force", "--yes"],
      {
        input: val,
        stdio: ["pipe", "inherit", "inherit"],
        cwd: resolve(import.meta.dirname, ".."),
      },
    );
    console.log(`[ok] ${key} → ${envName}`);
  }
}

console.log("Done. Redeploy: npx vercel deploy --prod");
