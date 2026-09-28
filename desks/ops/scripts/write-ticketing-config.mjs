/**
 * Writes public/ticketing/js/{config,env}.js from env vars.
 * Same Supabase project as transport by default (NEXT_PUBLIC_SUPABASE_*).
 * Optional override: TICKETING_SUPABASE_URL / TICKETING_SUPABASE_ANON_KEY.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
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

const url = (
  process.env.TICKETING_SUPABASE_URL ||
  process.env.SUPABASE_TICKETING_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();
const key = (
  process.env.TICKETING_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_TICKETING_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

const usingTransportFallback =
  !process.env.TICKETING_SUPABASE_URL &&
  !process.env.SUPABASE_TICKETING_URL &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const jsDir = path.join(root, "public", "ticketing", "js");
fs.mkdirSync(jsDir, { recursive: true });

const configOut = `/** Auto-generated — do not commit */
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;

const envOut = `/** Auto-generated — do not commit */
window.__SL_ENV__ = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  BUILD_ID: "ops-local",
};
`;

fs.writeFileSync(path.join(jsDir, "config.js"), configOut);
fs.writeFileSync(path.join(jsDir, "env.js"), envOut);

if (!url || !key) {
  console.warn(
    "write-ticketing-config: missing Supabase URL/anon key — set NEXT_PUBLIC_SUPABASE_* (or TICKETING_SUPABASE_*) in .env.local",
  );
} else {
  console.log(
    usingTransportFallback
      ? "Wrote ticketing config from NEXT_PUBLIC_SUPABASE_* (same project as transport)"
      : "Wrote public/ticketing/js/config.js + env.js",
  );
}
