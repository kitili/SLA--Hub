/**
 * Import the cleaned 2026 leads register into marketing_leads.
 *
 * Usage (from backend/):
 *   node scripts/import-leads-tracker.js
 *   node scripts/import-leads-tracker.js --fresh   # replace existing leads
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const db = require('../db');

const DATA_PATH = path.join(__dirname, '..', 'data', 'leads-tracker-2026.json');
const FRESH = process.argv.includes('--fresh');
const CHUNK = 80;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getCampusMap() {
  const { rows } = await db.query('SELECT id, code FROM campuses');
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
}

async function getMarketingUserId() {
  const { rows } = await db.query(
    "SELECT id FROM users WHERE email IN ('marketing@silverleaf.co.tz','eric@silverleaf.co.tz') ORDER BY id LIMIT 1"
  );
  return rows[0]?.id || null;
}

async function clearLeads() {
  console.log('Clearing existing leads (campaigns and social kept)…');
  await db.query(`
    TRUNCATE admission_payments, admission_applications, interview_bookings,
             tour_bookings, follow_up_tasks, waitlist, lead_form_reminders,
             marketing_leads
    RESTART IDENTITY CASCADE
  `);
  await db.query('TRUNCATE lead_contact_attempts RESTART IDENTITY CASCADE').catch(() => {});
}

async function insertChunk(rows, campusMap, createdBy) {
  const values = [];
  const params = [];
  let n = 0;
  const meta = [];
  for (const lead of rows) {
    const campusId = campusMap[lead.campus_code];
    if (!campusId || !lead.parent_name) continue;
    const createdAt = lead.captured_at ? `${lead.captured_at}T12:00:00Z` : new Date().toISOString();
    const i = n * 20;
    values.push(
      `($${i + 1},$${i + 2},$${i + 3},$${i + 4},$${i + 5},$${i + 6},$${i + 7},$${i + 8},$${i + 9},$${i + 10},$${i + 11},$${i + 12},$${i + 13},$${i + 14},$${i + 15},$${i + 16},$${i + 17},$${i + 18},$${i + 19},$${i + 20})`
    );
    params.push(
      campusId,
      createdBy,
      lead.parent_name,
      lead.parent_phone || null,
      lead.parent_phone2 || null,
      lead.child_name || null,
      lead.child_gender || null,
      lead.interested_class || null,
      lead.boarding_day === 'boarding' ? 'boarding' : 'day',
      lead.num_children || 1,
      lead.occupation || null,
      lead.residence || null,
      lead.region || null,
      lead.source || 'other',
      lead.how_heard || null,
      lead.source_detail || 'Leads Tracker 2026',
      lead.notes || null,
      lead.stage || 'interested_lead',
      lead.intended_term || null,
      createdAt
    );
    meta.push({ campusId, stage: lead.stage, outcome: lead.interview_outcome, visited: lead.visited, child: lead.child_name, parent: lead.parent_name, phone: lead.parent_phone });
    n += 1;
  }
  if (!n) return [];
  const { rows: inserted } = await db.query(
    `INSERT INTO marketing_leads
       (campus_id, created_by, parent_name, parent_phone, parent_phone2,
        child_name, child_gender, interested_class, boarding_day, num_children,
        occupation, residence, region, source, how_heard, source_detail, notes,
        computed_stage, intended_term, created_at)
     VALUES ${values.join(',')}
     RETURNING id, campus_id, computed_stage`,
    params
  );
  return inserted.map((row, idx) => ({ ...row, ...meta[idx] }));
}

async function addFunnelRows(inserted, createdBy) {
  const tours = [];
  const interviews = [];
  const apps = [];
  const pays = [];
  inserted.forEach((row, idx) => {
    const advanced = ['tour_booked', 'interview_booked', 'form_filled', 'enrolled', 'admission_paid'];
    if (row.visited || advanced.includes(row.stage)) {
      tours.push({ id: row.id, campusId: row.campus_id });
    }
    if (row.outcome || ['interview_booked', 'form_filled'].includes(row.stage)) {
      interviews.push({
        id: row.id,
        campusId: row.campus_id,
        outcome: row.outcome === 'failed' ? 'failed' : row.outcome === 'passed' ? 'passed' : 'pending',
      });
    }
    if (['form_filled', 'enrolled', 'admission_paid'].includes(row.stage)) {
      const first = (row.child || 'Child').split(' ')[0];
      apps.push({ id: row.id, campusId: row.campus_id, first, parent: row.parent, phone: row.phone });
    }
    if (row.stage === 'admission_paid') {
      pays.push({ id: row.id, campusId: row.campus_id, ref: `LT26-${row.id}` });
    }
  });

  for (const group of chunk(tours, CHUNK)) {
    const vals = [];
    const params = [];
    group.forEach((t, i) => {
      const b = i * 3;
      vals.push(`($${b + 1},$${b + 2},CURRENT_DATE - 40,'10:00','completed',$${b + 3})`);
      params.push(t.id, t.campusId, createdBy);
    });
    await db.query(
      `INSERT INTO tour_bookings (lead_id, campus_id, tour_date, tour_time, status, conducted_by) VALUES ${vals.join(',')}`,
      params
    );
  }

  for (const group of chunk(interviews, CHUNK)) {
    const vals = [];
    const params = [];
    group.forEach((t, i) => {
      const b = i * 4;
      vals.push(`($${b + 1},$${b + 2},CURRENT_DATE - 25,'11:00','completed',$${b + 3},$${b + 4})`);
      params.push(t.id, t.campusId, t.outcome, createdBy);
    });
    await db.query(
      `INSERT INTO interview_bookings (lead_id, campus_id, interview_date, interview_time, status, outcome, conducted_by)
       VALUES ${vals.join(',')}`,
      params
    );
  }

  for (const group of chunk(apps, CHUNK)) {
    const vals = [];
    const params = [];
    group.forEach((t, i) => {
      const b = i * 5;
      vals.push(`($${b + 1},$${b + 2},$${b + 3},'Student',$${b + 4},$${b + 5},'G1',NOW() - INTERVAL '14 days')`);
      params.push(t.id, t.campusId, t.first, t.parent, t.phone || '0000000000');
    });
    await db.query(
      `INSERT INTO admission_applications
         (lead_id, campus_id, student_first_name, student_last_name, parent_name, parent_phone, class_applying_for, submitted_at)
       VALUES ${vals.join(',')}`,
      params
    );
  }

  if (pays.length) {
    await db.query(
      `UPDATE admission_applications SET enrolled_at = NOW() - INTERVAL '7 days'
       WHERE lead_id = ANY($1::int[])`,
      [pays.map((p) => p.id)]
    );
  }

  for (const group of chunk(pays, CHUNK)) {
    const vals = [];
    const params = [];
    group.forEach((t, i) => {
      const b = i * 4;
      vals.push(`($${b + 1},$${b + 2},850000,'TZS','bank_transfer',$${b + 3},NOW() - INTERVAL '3 days',$${b + 4})`);
      params.push(t.id, t.campusId, t.ref, createdBy);
    });
    await db.query(
      `INSERT INTO admission_payments (lead_id, campus_id, amount, currency, payment_method, reference_number, paid_at, received_by)
       VALUES ${vals.join(',')}`,
      params
    );
  }

  const deadIds = inserted.filter((r) => r.stage === 'dead_lead').map((r) => r.id);
  if (deadIds.length) {
    await db.query(
      `UPDATE marketing_leads SET computed_stage = 'dead_lead',
              decline_reason = COALESCE(NULLIF(notes,''), 'Dead lead (2026 tracker)')
       WHERE id = ANY($1::int[])`,
      [deadIds]
    );
  }
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('Run python3 scripts/parse-leads-tracker.py first');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`Importing ${data.leads.length} leads from ${data.source_file}`);

  const campusMap = await getCampusMap();
  const createdBy = await getMarketingUserId();
  if (!createdBy) {
    console.error('No marketing user. Run node seed.js first.');
    process.exit(1);
  }

  if (FRESH) await clearLeads();

  let inserted = [];
  let done = 0;
  for (const group of chunk(data.leads, CHUNK)) {
    const rows = await insertChunk(group, campusMap, createdBy);
    inserted = inserted.concat(rows);
    done += group.length;
    process.stdout.write(`  inserted ${inserted.length}/${data.leads.length}\r`);
  }
  console.log(`\n  ${inserted.length} leads stored. Adding funnel rows…`);
  await addFunnelRows(inserted, createdBy);

  const { rows: counts } = await db.query(`
    SELECT computed_stage, COUNT(*)::int AS n
    FROM marketing_leads GROUP BY computed_stage ORDER BY n DESC
  `);
  console.log('Live funnel:', counts.map((r) => `${r.computed_stage}=${r.n}`).join(', '));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
