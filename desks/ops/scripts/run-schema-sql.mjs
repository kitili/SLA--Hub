#!/usr/bin/env node
/**
 * Apply a Supabase SQL schema file via psql.
 *
 * Requires DATABASE_URL in .env.local (Supabase → Project Settings → Database
 * → Connection string → URI, session mode or direct on port 5432).
 *
 * Usage:
 *   node scripts/run-schema-sql.mjs supabase/schema_kitchen.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD ?? process.env.POSTGRES_PASSWORD;
  if (!url || !password) return null;

  const host = new URL(url).hostname;
  const projectRef = host.replace(/\.supabase\.co$/, "");
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

function main() {
  loadEnvLocal();
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/run-schema-sql.mjs <path-to.sql>");
    process.exit(1);
  }

  const sqlPath = resolve(process.cwd(), fileArg);
  if (!existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
  }

  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      "Missing DATABASE_URL (or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD) in .env.local.",
    );
    console.error(
      "Add the Supabase Database URI from Project Settings → Database → Connection string.",
    );
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  console.log(`Applying ${fileArg} (${sql.length} bytes)…`);

  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    console.error(`psql exited with code ${result.status ?? "unknown"}`);
    process.exit(result.status ?? 1);
  }

  console.log("Done.");
}

main();
