/**
 * Marketing conversion smoke test — login + hit every marketing read API,
 * create a lead (with phone), then decline it with a reason.
 *
 * Usage (from backend/):
 *   node scripts/smoke-marketing.js
 *
 * Reads DEFAULT_PASSWORD + optional SMOKE_EMAIL from .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.SMOKE_API_URL || 'http://127.0.0.1:5001/api';
const EMAIL = process.env.SMOKE_EMAIL || 'marketing@silverleaf.co.tz';
const PASSWORD = process.env.DEFAULT_PASSWORD;

if (!PASSWORD) {
  console.error('DEFAULT_PASSWORD missing in backend/.env');
  process.exit(1);
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const steps = [];
  const log = (name, ok, detail = '') => {
    steps.push({ name, ok, detail });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const login = await req('POST', '/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
    });
    assert(login.status === 200 && login.data.token, `login failed (${login.status})`);
    const token = login.data.token;
    log('POST /auth/login', true, login.data.user?.role);

    if (login.data.mustChangePassword) {
      console.warn('! Account must change password — remaining tests may 403.');
    }

    const publicGets = [
      '/public/campuses',
      '/public/calendar',
      '/public/calendar.ics',
    ];
    for (const path of publicGets) {
      const r = await req('GET', path);
      const ok = r.status >= 200 && r.status < 300;
      log(`GET ${path}`, ok, String(r.status));
      assert(ok, `GET ${path} → ${r.status}`);
    }

    const gets = [
      '/marketing/dashboard',
      '/marketing/analytics?period=monthly',
      '/marketing/leads?limit=50',
      '/marketing/campaigns',
      '/marketing/admission-form',
      '/marketing/events',
      '/marketing/sis/parents',
      '/marketing/sis/students',
      '/admin/campuses',
    ];
    for (const path of gets) {
      const r = await req('GET', path, { token });
      const ok = r.status >= 200 && r.status < 300;
      log(`GET ${path}`, ok, String(r.status));
      assert(ok, `GET ${path} → ${r.status}`);
    }

    const campuses = await req('GET', '/admin/campuses', { token });
    const campusId = campuses.data?.[0]?.id || campuses.data?.data?.[0]?.id;
    assert(campusId, 'No campus to attach lead to');

    const bad = await req('POST', '/marketing/leads', {
      token,
      body: { campus_id: campusId, parent_name: 'Smoke NoPhone' },
    });
    log('POST /leads rejects missing phone', bad.status === 400, String(bad.status));
    assert(bad.status === 400, 'Expected 400 without phone');

    const stamp = Date.now().toString().slice(-6);
    const created = await req('POST', '/marketing/leads', {
      token,
      body: {
        campus_id: campusId,
        parent_name: `Smoke Parent ${stamp}`,
        parent_phone: `07${stamp.padStart(8, '0').slice(0, 8)}`,
        whatsapp_number: `07${stamp.padStart(8, '0').slice(0, 8)}`,
        occupation: 'Teacher',
        residence: 'Usa River',
        region: 'Arusha',
        child_name: `Smoke Child ${stamp}`,
        child_age: 4,
        child_gender: 'female',
        interested_class: 'KG1',
        boarding_day: 'day',
        num_children: 1,
        intended_term: 'January 2027',
        source: 'walk_in',
        how_heard: 'School visit',
        source_detail: 'N/A',
        notes: 'Created by smoke-marketing.js — safe to decline',
      },
    });
    log('POST /leads create', created.status === 200 && !!created.data.lead?.id, String(created.status));
    assert(created.data.lead?.id, 'Lead not created');
    const leadId = created.data.lead.id;

    const declined = await req('PATCH', `/marketing/leads/${leadId}/status`, {
      token,
      body: { status: 'declined', reason: 'Smoke test cleanup' },
    });
    log('PATCH /leads/:id/status decline', declined.status === 200, String(declined.status));
    assert(declined.status === 200, 'Decline failed');

    const apply = await req('POST', '/apply', {
      body: {
        campus_id: campusId,
        parent_name: `Smoke Apply ${stamp}`,
        parent_phone: `06${stamp.padStart(8, '0').slice(0, 8)}`,
        child_name: `Smoke Apply Child ${stamp}`,
        interested_class: 'KG1',
        utm_source: 'website',
        utm_medium: 'organic',
        utm_campaign: 'october-2026-intake',
      },
    });
    log('POST /apply public inquiry', apply.status === 200 && !!apply.data.leadId, String(apply.status));
    assert(apply.status === 200 && apply.data.leadId, 'Public apply failed');

    await req('DELETE', `/marketing/leads/${leadId}`, { token });
    const archivedApply = await req('DELETE', `/marketing/leads/${apply.data.leadId}`, { token });
    log('cleanup archive smoke leads', archivedApply.status === 200, String(archivedApply.status));

    console.log('\nAll marketing smoke checks passed.');
    process.exit(0);
  } catch (err) {
    console.error('\nSmoke failed:', err.message);
    process.exit(1);
  }
}

main();
