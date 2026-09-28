#!/usr/bin/env node
/**
 * Probe Silverleaf Ed-admin GET endpoints (reads .env or .env.local).
 *
 *   node scripts/probe-edadmin.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const key = env.EDADMIN_GENERAL_API_KEY?.trim();
const base = (env.EDADMIN_BASE_URL?.trim() || "https://silverleafacademy.ed-space.net").replace(/\/+$/, "");

if (!key) {
  console.error("Set EDADMIN_GENERAL_API_KEY in .env or .env.local");
  process.exit(1);
}

const paths = [
  "/api/general/v1/Parents",
  "/api/general/v1/Students",
  "/api/general/v1/StudentClasses",
];

console.log(`Probing ${base} (campus: ${env.EDADMIN_CAMPUS || "Silverleaf"})\n`);

for (const path of paths) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/xml" },
    });
    const text = await res.text();
    const tag = path.includes("StudentClasses")
      ? "StudentClasses"
      : path.includes("Students")
        ? "Students"
        : "Parents";
    const count = (text.match(new RegExp(`<${tag}>`, "gi")) ?? []).length;
    console.log(`${path} → HTTP ${res.status} · ~${count} ${tag} records`);
    if (!res.ok) console.log(`  ${text.slice(0, 120)}`);
  } catch (error) {
    console.log(`${path} → ERROR ${error instanceof Error ? error.message : error}`);
  }
}
