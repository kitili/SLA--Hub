/**
 * Go-live smoke — readiness, marketing loop, webhooks, agent approve-without-send.
 *
 * Usage (from backend/):
 *   node scripts/smoke-live.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.SMOKE_API_URL || 'http://127.0.0.1:5000/api';
const EMAIL = process.env.SMOKE_EMAIL || 'marketing@silverleaf.co.tz';
const PASSWORD = process.env.SMOKE_PASSWORD || process.env.DEFAULT_PASSWORD;
const WEBHOOK = process.env.EDADMIN_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

if (!PASSWORD) {
  console.error('DEFAULT_PASSWORD missing in backend/.env');
  process.exit(1);
}

async function req(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const log = (name, ok, detail = '') => {
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
  };

  const health = await req('GET', '/health');
  log('GET /health', health.status === 200 && health.data.status === 'online', String(health.status));

  const live = await req('GET', '/health/live');
  log(
    'GET /health/live',
    live.status === 200 || live.status === 503,
    `go_live=${live.data.go_live} blockers=${(live.data.blockers || []).join(',') || 'none'}`
  );
  assert(Array.isArray(live.data.blockers), 'health/live missing blockers');
  assert(live.data.connections, 'health/live missing connections');

  const login = await req('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  assert(login.status === 200 && login.data.token, `login failed (${login.status})`);
  const token = login.data.token;
  log('POST /auth/login', true, login.data.user?.role);
  const setCookie = login.headers.get('set-cookie') || '';
  assert(/sla_mse_session=/.test(setCookie), 'login must set httpOnly session cookie');
  assert(/HttpOnly/i.test(setCookie), 'session cookie must be HttpOnly');
  log('login sets httpOnly session cookie', true);

  const cookieHeader = setCookie.split(',')[0].split(';')[0];
  const me = await req('GET', '/auth/me', { headers: { Cookie: cookieHeader } });
  log('GET /auth/me via cookie (no Bearer)', me.status === 200 && me.data.user?.id, String(me.status));

  const loggedOut = await req('POST', '/auth/logout');
  log('POST /auth/logout clears cookie', loggedOut.status === 200 && /Max-Age=0/i.test(loggedOut.headers.get('set-cookie') || ''), String(loggedOut.status));

  const ready = await req('GET', '/marketing/readiness', { token });
  log('GET /marketing/readiness', ready.status === 200 && Array.isArray(ready.data.phases), String(ready.status));
  assert(ready.data.phases?.length >= 5, 'Expected 5 go-live phases');

  for (const path of ['/marketing/dashboard', '/marketing/leads?limit=20', '/marketing/master-snapshot', '/marketing/agent/queue', '/marketing/agent/actions']) {
    const r = await req('GET', path, { token });
    log(`GET ${path}`, r.status === 200, String(r.status));
  }

  const campuses = await req('GET', '/admin/campuses', { token });
  const campusId = campuses.data?.[0]?.id || campuses.data?.data?.[0]?.id;
  assert(campusId, 'No campus');

  const stamp = Date.now().toString().slice(-6);
  const created = await req('POST', '/marketing/leads', {
    token,
    body: {
      campus_id: campusId,
      parent_name: `Live Parent ${stamp}`,
      parent_phone: `07${stamp.padStart(8, '0').slice(0, 8)}`,
      whatsapp_number: `07${stamp.padStart(8, '0').slice(0, 8)}`,
      occupation: 'Teacher',
      residence: 'Usa River',
      region: 'Arusha',
      child_name: `Live Child ${stamp}`,
      child_age: 4,
      child_gender: 'female',
      interested_class: 'KG1',
      boarding_day: 'day',
      num_children: 1,
      intended_term: 'January 2027',
      source: 'walk_in',
      how_heard: 'School visit',
      source_detail: 'N/A',
      notes: 'Created by smoke-live.js',
    },
  });
  log('POST /leads', created.status === 200 && !!created.data.lead?.id, String(created.status));
  const lead = created.data.lead;
  assert(typeof lead.sibling_flag === 'boolean', 'sibling_flag must be boolean');
  assert(lead.vitality?.next, 'vitality.next missing');
  log('sibling_flag is boolean (no local student dump)', true, String(lead.sibling_flag));
  log('vitality attached', true, lead.vitality.status);

  const contact = await req('POST', `/marketing/leads/${lead.id}/contacts`, {
    token,
    body: { channel: 'whatsapp', outcome: 'left_message', notes: 'smoke-live contact' },
  });
  log('POST /leads/:id/contacts', contact.status === 200 && contact.data.contact?.id, String(contact.status));

  const proposed = await req('POST', '/marketing/agent/propose', {
    token,
    body: { lead_id: lead.id, action_type: 'send_whatsapp', notes: 'smoke-live' },
  });
  log('POST /agent/propose', proposed.status === 200 && proposed.data.action?.status === 'pending', String(proposed.status));
  const actionId = proposed.data.action.id;
  assert(proposed.data.action.payload?.draft, 'propose must store a draft');

  const approved = await req('POST', `/marketing/agent/actions/${actionId}/approve`, { token });
  log(
    'POST /agent/actions/:id/approve',
    approved.status === 200 && ['executed', 'skipped'].includes(approved.data.action?.status),
    `${approved.data.action?.status} — ${approved.data.action?.result || ''}`
  );
  if (!process.env.AT_API_KEY || /replace|your-|<.*>/i.test(process.env.AT_API_KEY || '')) {
    assert(approved.data.action.status === 'skipped', 'Approve without AT must skip send, not execute');
    log('approve without Africa’s Talking does not send', true);
  }

  const rejectedPropose = await req('POST', '/marketing/agent/propose', {
    token,
    body: { lead_id: lead.id, action_type: 'mark_dead' },
  });
  const rejected = await req('POST', `/marketing/agent/actions/${rejectedPropose.data.action.id}/reject`, { token });
  log('POST /agent/actions/:id/reject', rejected.status === 200 && rejected.data.action?.status === 'rejected', String(rejected.status));

  const noSecret = await req('POST', '/webhooks/edadmin/application-submitted', { body: { lead_id: lead.id } });
  log('webhook without secret is 401/503', noSecret.status === 401 || noSecret.status === 503, String(noSecret.status));

  if (WEBHOOK) {
    const bad = await req('POST', '/webhooks/edadmin/application-submitted', {
      body: { lead_id: lead.id },
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    log('webhook with wrong secret is 401', bad.status === 401, String(bad.status));

    const ok = await req('POST', '/webhooks/edadmin/application-submitted', {
      body: { lead_id: lead.id, edadmin_ref: `smoke-${stamp}` },
      headers: { Authorization: `Bearer ${WEBHOOK}` },
    });
    log('webhook application-submitted with secret', ok.status === 200 && ok.data.success, String(ok.status));
  } else {
    log('webhook secret not set — skip signed webhook', true);
  }

  await req('PATCH', `/marketing/leads/${lead.id}/status`, {
    token,
    body: { status: 'declined', reason: 'smoke-live cleanup' },
  });
  await req('DELETE', `/marketing/leads/${lead.id}`, { token });
  log('cleanup archive smoke lead', true);

  console.log('\nAll live smoke checks passed.');
  if (!live.data.go_live) {
    console.log(`Go-live still blocked by: ${(live.data.blockers || []).join(', ')}`);
  }
}

main().catch((err) => {
  console.error('\nLive smoke failed:', err.message);
  process.exit(1);
});
