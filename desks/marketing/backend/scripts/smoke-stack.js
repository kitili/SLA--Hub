/**
 * Full-stack smoke test — API + Next.js proxy + page routes.
 *
 * Usage (from backend/):
 *   node scripts/smoke-stack.js
 *
 * Env:
 *   SMOKE_API_URL   default http://127.0.0.1:5000/api
 *   SMOKE_WEB_URL   default http://127.0.0.1:3180
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawnSync } = require('child_process');

const WEB = process.env.SMOKE_WEB_URL || 'http://127.0.0.1:3180';
const EMAIL = process.env.SMOKE_EMAIL || 'marketing@silverleaf.co.tz';
const PASSWORD = process.env.DEFAULT_PASSWORD;

if (!PASSWORD) {
  console.error('DEFAULT_PASSWORD missing in backend/.env');
  process.exit(1);
}

async function get(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, ok: res.status >= 200 && res.status < 400 };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function log(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
}

async function main() {
  console.log('=== API smoke (direct) ===');
  const api = spawnSync(process.execPath, ['scripts/smoke-marketing.js'], {
    cwd: require('path').join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  if (api.status !== 0) process.exit(api.status || 1);

  console.log('\n=== Next.js proxy + routes ===');
  const health = await get(`${WEB}/api/health`);
  log('GET /api/health (via Next proxy)', health.ok, String(health.status));

  const login = await postJson(`${WEB}/api/auth/login`, { email: EMAIL, password: PASSWORD });
  log('POST /api/auth/login (via Next proxy)', login.status === 200 && !!login.data.token, login.data.user?.role || String(login.status));
  const token = login.data.token;

  const dash = await fetch(`${WEB}/api/marketing/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  log('GET /api/marketing/dashboard (via Next proxy)', dash.status === 200, String(dash.status));

  for (const path of ['/login', '/marketing', '/marketing/leads', '/marketing/analytics', '/apply', '/calendar', '/calendar/embed']) {
    const page = await get(`${WEB}${path}`);
    log(`GET ${path}`, page.ok, String(page.status));
  }

  console.log('\nAll stack smoke checks passed.');
}

main().catch((err) => {
  console.error('\nStack smoke failed:', err.message);
  process.exit(1);
});
