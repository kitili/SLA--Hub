/**
 * Seed marketing dashboard with real figures from
 * Marketing Master Dashboard Ongoing (Feb 2026).
 *
 * Creates a proportional lead sample (not 900+ rows) plus full
 * social analytics and campaigns from the master sheet.
 *
 * Usage (from backend/):
 *   node scripts/seed-marketing-dashboard.js
 *   node scripts/seed-marketing-dashboard.js --fresh
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const db = require('../db');

const DATA_PATH = path.join(__dirname, '..', 'data', 'marketing-master-dashboard-2026.json');
const FRESH = process.argv.includes('--fresh');
const SAMPLE_PER_CAMPUS = 24;

function phoneFor(idx) {
  return `0${String(700000000 + idx).slice(-9)}`;
}

async function getCampusMap() {
  const { rows } = await db.query('SELECT id, code, name FROM campuses ORDER BY id');
  const map = {};
  rows.forEach((r) => { map[r.code] = r.id; });
  return map;
}

async function getMarketingUserId() {
  const { rows } = await db.query(
    "SELECT id FROM users WHERE email = 'marketing@silverleaf.co.tz' LIMIT 1"
  );
  return rows[0]?.id || null;
}

async function clearMarketingDemo() {
  console.log('🧹 Clearing existing marketing demo data…');
  await db.query(`
    TRUNCATE admission_payments, admission_applications, interview_bookings,
             tour_bookings, follow_up_tasks, waitlist, lead_form_reminders,
             marketing_leads, social_analytics, marketing_campaigns
    RESTART IDENTITY CASCADE
  `);
  await db.query("DELETE FROM school_events WHERE title LIKE 'Dashboard seed:%'");
}

function exclusiveStages(funnel) {
  const total = funnel.total_leads || SAMPLE_PER_CAMPUS;
  const paid = Math.min(funnel.enrolled_admission_paid || 0, total);
  const dead = Math.min(funnel.dead_leads || 0, total - paid);
  const registered = Math.min(funnel.registered || 0, total - paid - dead);
  const interview = Math.min(funnel.passed_interview || 0, total - paid - dead - registered);
  const interested = Math.max(0, total - paid - dead - registered - interview);
  return { paid, dead, registered, interview, interested, total };
}

function scaleCounts(counts, sampleSize) {
  const sum = counts.paid + counts.dead + counts.registered + counts.interview + counts.interested;
  if (sum <= sampleSize) return counts;
  const scale = sampleSize / sum;
  const scaled = {
    paid: Math.round(counts.paid * scale),
    dead: Math.round(counts.dead * scale),
    registered: Math.round(counts.registered * scale),
    interview: Math.round(counts.interview * scale),
    interested: 0,
  };
  scaled.interested = sampleSize - scaled.paid - scaled.dead - scaled.registered - scaled.interview;
  if (scaled.interested < 0) scaled.interested = 0;
  return scaled;
}

async function insertLead({ campusId, createdBy, parentName, parentPhone, childName, interestedClass, source, sourceDetail, notes }) {
  const { rows } = await db.query(
    `INSERT INTO marketing_leads
       (campus_id, created_by, parent_name, parent_phone, child_name, interested_class, source, source_detail, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [campusId, createdBy, parentName, parentPhone, childName, interestedClass, source, sourceDetail || null, notes || null]
  );
  return rows[0].id;
}

async function advanceLead(leadId, campusId, createdBy, stage, idx, childName) {
  const d = (offset) => {
    const x = new Date();
    x.setDate(x.getDate() - offset);
    return x.toISOString().slice(0, 10);
  };
  const cls = ['Daycare', 'KG1', 'KG2', 'G1', 'G2'][idx % 5];

  if (['tour_booked', 'interview_booked', 'form_filled', 'enrolled', 'admission_paid'].includes(stage)) {
    await db.query(
      `INSERT INTO tour_bookings (lead_id, campus_id, tour_date, tour_time, status, conducted_by)
       VALUES ($1,$2,$3,'10:00','completed',$4)`,
      [leadId, campusId, d(40), createdBy]
    );
  }
  if (['interview_booked', 'form_filled', 'enrolled', 'admission_paid'].includes(stage)) {
    await db.query(
      `INSERT INTO interview_bookings (lead_id, campus_id, interview_date, interview_time, status, outcome, conducted_by)
       VALUES ($1,$2,$3,'11:00','completed','passed',$4)`,
      [leadId, campusId, d(25), createdBy]
    );
  }
  if (['form_filled', 'enrolled', 'admission_paid'].includes(stage)) {
    await db.query(
      `INSERT INTO admission_applications
         (lead_id, campus_id, student_first_name, student_last_name, parent_name, parent_phone, class_applying_for, submitted_at)
       VALUES ($1,$2,$3,'Student',$4,(SELECT parent_phone FROM marketing_leads WHERE id=$1),$5,NOW() - INTERVAL '14 days')`,
      [leadId, campusId, childName.split(' ')[0], childName, cls]
    );
  }
  if (['enrolled', 'admission_paid'].includes(stage)) {
    await db.query(`UPDATE admission_applications SET enrolled_at = NOW() - INTERVAL '7 days' WHERE lead_id = $1`, [leadId]);
  }
  if (stage === 'admission_paid') {
    await db.query(
      `INSERT INTO admission_payments (lead_id, campus_id, amount, currency, payment_method, reference_number, paid_at, received_by)
       VALUES ($1,$2,850000,'TZS','bank_transfer',$3,NOW() - INTERVAL '3 days',$4)`,
      [leadId, campusId, `PAY26-${idx}`, createdBy]
    );
  }
  if (stage === 'dead_lead') {
    await db.query(
      `UPDATE marketing_leads SET computed_stage = 'dead_lead', decline_reason = 'No response after follow-ups (master sheet)'
       WHERE id = $1`,
      [leadId]
    );
  }
}

async function seedCampusSample(campusMap, createdBy, code, funnel, startIdx) {
  const campusId = campusMap[code];
  if (!campusId) return startIdx;
  const counts = scaleCounts(exclusiveStages(funnel), SAMPLE_PER_CAMPUS);
  const plan = [
    ['admission_paid', counts.paid, 'referral'],
    ['form_filled', counts.registered, 'online_form'],
    ['interview_booked', counts.interview, 'phone_call'],
    ['dead_lead', counts.dead, 'social_media'],
    ['interested_lead', counts.interested, 'walk_in'],
  ];
  let idx = startIdx;
  for (const [stage, n, source] of plan) {
    for (let i = 0; i < n; i++) {
      idx++;
      const childName = `Prospect ${code}-${idx}`;
      const leadId = await insertLead({
        campusId,
        createdBy,
        parentName: `${funnel.name.split(' ')[0]} Parent ${idx}`,
        parentPhone: phoneFor(idx),
        childName,
        interestedClass: ['Daycare', 'KG1', 'KG2', 'G1', 'G2'][idx % 5],
        source,
        sourceDetail: `Master dashboard ${code} (${funnel.total_leads} total in sheet)`,
        notes: `Sample lead — sheet stage mix for ${code}`,
      });
      if (stage !== 'interested_lead') await advanceLead(leadId, campusId, createdBy, stage, idx, childName);
    }
  }
  console.log(`  🏫 ${code}: ${SAMPLE_PER_CAMPUS} sample leads (sheet total ${funnel.total_leads})`);
  return idx;
}

async function seedReferrals(campusMap, createdBy, referrals, startIdx) {
  let idx = startIdx;
  for (const ref of referrals) {
    idx++;
    const campusId = campusMap[ref.campus_code];
    if (!campusId) continue;
    const leadId = await insertLead({
      campusId,
      createdBy,
      parentName: ref.parent_name,
      parentPhone: phoneFor(idx),
      childName: ref.child_name,
      interestedClass: ref.interested_class,
      source: ref.source,
      sourceDetail: ref.source_detail,
      notes: 'From 2026 Staff Referrals tab',
    });
    await advanceLead(leadId, campusId, createdBy, 'admission_paid', idx, ref.child_name);
  }
  return idx;
}

async function seedSocial(data) {
  let n = 0;
  for (const row of data.social_following) {
    const output = data.social_output.find((o) => o.platform === row.platform && o.month === row.month);
    const posts = output?.posts_count || 0;
    const engagement = row.followers && row.target_followers
      ? Math.min(99, Math.round((row.followers / row.target_followers) * 100) / 100)
      : 0;
    await db.query(
      `INSERT INTO social_analytics
         (campus_id, platform, date, followers, reach, impressions, engagement_rate, posts_count, source)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, 'manual')
       ON CONFLICT (campus_id, platform, date)
       DO UPDATE SET followers = EXCLUDED.followers, posts_count = EXCLUDED.posts_count,
                     engagement_rate = EXCLUDED.engagement_rate`,
      [row.platform, row.date, row.followers, Math.round(row.followers * 1.8),
        Math.round(row.followers * 2.4), engagement, posts]
    );
    n++;
  }
  return n;
}

async function seedCampaigns(createdBy, campaigns) {
  let n = 0;
  for (const c of campaigns) {
    const exists = await db.query('SELECT id FROM marketing_campaigns WHERE name = $1', [c.name]);
    if (exists.rows.length) continue;
    await db.query(
      `INSERT INTO marketing_campaigns
         (campus_id, name, type, start_date, end_date, budget, spent, leads_generated, conversions, status, station_name, platform, created_by)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [c.name, c.type, c.start_date, c.end_date, c.budget, c.spent,
        c.leads_generated || 0, c.conversions || 0, c.status,
        c.station_name || null, c.platform || null, createdBy]
    );
    n++;
  }
  return n;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log('📊 Seeding from', data.source_file);

  const campusMap = await getCampusMap();
  const createdBy = await getMarketingUserId();
  if (!createdBy) {
    console.error('Run node seed.js first');
    process.exit(1);
  }

  if (FRESH) await clearMarketingDemo();

  let idx = 1000;
  for (const code of ['ACC', 'USR', 'BOM', 'KJG', 'ILB']) {
    if (data.campus_funnel[code]) idx = await seedCampusSample(campusMap, createdBy, code, data.campus_funnel[code], idx);
  }
  idx = await seedReferrals(campusMap, createdBy, data.referral_leads, idx);
  const socialN = await seedSocial(data);
  const campaignN = await seedCampaigns(createdBy, data.campaigns);

  await db.query(
    `INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, created_by)
     VALUES
       (NULL, 'Dashboard seed: March Open Day', 'From Social Media Calendar', 'open_day', '2026-03-15', '2026-03-15', $1),
       (NULL, 'Dashboard seed: Campus Tour Week', 'Usa River enrollment push', 'open_day', '2026-04-07', '2026-04-11', $1)`,
    [createdBy]
  ).catch(() => {});

  const { rows: counts } = await db.query(`
    SELECT computed_stage, COUNT(*)::int AS n FROM marketing_leads GROUP BY computed_stage ORDER BY n DESC
  `);

  console.log('\n✅ Seed complete');
  console.log(`   Social rows: ${socialN} | Campaigns: ${campaignN} | Referrals: ${data.referral_leads.length}`);
  console.log('   Live funnel:', counts.map((r) => `${r.computed_stage}=${r.n}`).join(', '));
  console.log('\n   Master sheet totals (for dashboard targets):');
  console.log(`     Leads: ${data.cluster.total_leads} | Paid: ${data.cluster.enrolled_admission_paid} | Dead: ${data.cluster.dead_leads}`);
  console.log(`     2026 enrollment target: ${data.cluster.target_enrollment_2026}`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
