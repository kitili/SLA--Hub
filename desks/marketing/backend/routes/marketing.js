const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const rateLimit = require('express-rate-limit');
const db      = require('../db');
const { authenticateSession, requireRole, requirePasswordChanged } = require('../middleware/auth');
const { sendEmail, sendSMS, sendWhatsApp }  = require('../middleware/notifications');
const { broadcast } = require('../lib/realtime');
const { BUCKETS, uploadFile, getSignedUrl } = require('../lib/storage');
const { sendServerError, escapeHtml, loadScopedRow, forbiddenOrNotFound } = require('../lib/safe');
const { attachVitality, computeLeadVitality, isFollowUpOverdue } = require('../lib/leadVitality');
const { validateLeadCreate } = require('../lib/leadCreate');
const buffer = require('../lib/buffer');
const { slugify } = require('../lib/slug');
const edadmin = require('../lib/edadmin');
const readiness = require('../lib/readiness');
const agentLoop = require('../lib/agentLoop');

async function siblingFlagForPhone(phone, campusId) {
  if (!phone) return false;
  try {
    let campusCode = null;
    if (campusId) {
      const { rows } = await db.query('SELECT code FROM campuses WHERE id = $1', [campusId]);
      campusCode = rows[0]?.code || null;
    }
    return edadmin.hasEnrolledSibling(phone, { campusCode });
  } catch (err) {
    console.error('Ed Admin sibling check failed:', err.message);
    return false;
  }
}

const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many applications from this IP. Please try again later.' },
});

// Public — parent inquiry form creates a lead at the start of the funnel.
// Does NOT insert admission_applications (that would jump to form_filled).
// Registered BEFORE authenticateSession so it stays reachable without a login token.
router.post('/apply', applyLimiter, async (req, res) => {
  const {
    campus_id, campus_code, parent_name, parent_phone, parent_email, parent_phone2,
    whatsapp_number, occupation, residence, region,
    child_name, child_age, child_gender, interested_class, boarding_day,
    how_heard, source_detail, campaign_id, campaign_slug,
    utm_source, utm_medium, utm_campaign, landing_page,
  } = req.body;

  if (!parent_name || !parent_phone)
    return res.status(400).json({ error: 'Campus, parent name and phone are required.' });
  const phoneDigits = String(parent_phone).replace(/\D/g, '');
  if (phoneDigits.length < 9)
    return res.status(400).json({ error: 'Enter a valid phone number (at least 9 digits).' });

  try {
    let campusId = campus_id;
    if (!campusId && campus_code) {
      const campus = await db.query(
        'SELECT id FROM campuses WHERE UPPER(code) = $1 AND is_active = TRUE LIMIT 1',
        [String(campus_code).toUpperCase()]
      );
      campusId = campus.rows[0]?.id;
    }
    if (!campusId)
      return res.status(400).json({ error: 'Campus, parent name and phone are required.' });

    let campaignId = campaign_id || null;
    const slug = campaign_slug || utm_campaign;
    if (!campaignId && slug) {
      const campaign = await db.query(
        `SELECT id FROM marketing_campaigns
         WHERE slug = $1 OR utm_campaign = $1
         LIMIT 1`,
        [String(slug)]
      );
      campaignId = campaign.rows[0]?.id || null;
    }

    const siblingFlag = await siblingFlagForPhone(parent_phone, campusId);

    const existing = await db.query(
      'SELECT id, computed_stage FROM marketing_leads WHERE parent_phone = $1 AND campus_id = $2 LIMIT 1',
      [parent_phone, campusId]
    );

    let leadId;
    if (existing.rows.length) {
      leadId = existing.rows[0].id;
      return res.json({ success: true, leadId, existing: true });
    }

    const leadResult = await db.query(
      `INSERT INTO marketing_leads
         (campus_id, parent_name, parent_phone, parent_phone2, parent_email,
          whatsapp_number, occupation, residence, region,
          child_name, child_age, child_gender, interested_class, boarding_day,
          how_heard, source_detail, campaign_id, sibling_flag, source,
          utm_source, utm_medium, utm_campaign, landing_page)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'online_form',$19,$20,$21,$22)
       RETURNING id`,
      [campusId, parent_name, parent_phone, parent_phone2, parent_email,
       whatsapp_number, occupation, residence, region,
       child_name, child_age, child_gender, interested_class, boarding_day,
       how_heard, source_detail, campaignId, siblingFlag,
       utm_source || null, utm_medium || null, utm_campaign || slug || null,
       landing_page || null]
    );
    leadId = leadResult.rows[0].id;

    const { rows: scoreRows } = await db.query(
      'SELECT compute_lead_score($1) AS score', [leadId]
    );
    await db.query('UPDATE marketing_leads SET lead_score = $1 WHERE id = $2', [scoreRows[0].score, leadId]);

    if (parent_email) {
      sendEmail({
        to: parent_email,
        subject: 'Application Received — Silverleaf Academy',
        html: `<p>Dear ${escapeHtml(parent_name)}, we have received your inquiry for ${escapeHtml(child_name || 'your child')} at Silverleaf Academy. Our team will be in touch shortly. Thank you!</p>`,
      });
    }

    if (campaignId) {
      await db.query(
        'UPDATE marketing_campaigns SET leads_generated = leads_generated + 1 WHERE id = $1',
        [campaignId]
      );
    }

    res.json({ success: true, leadId });
  } catch (err) {
    console.error('Public apply error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.use(authenticateSession);
router.use(requirePasswordChanged);

const MARKETING_ROLES = ['ceo', 'global_marketing_head', 'campus_marketing_head'];
router.use(requireRole(...MARKETING_ROLES));

function assertCampusAccess(scope, campusId) {
  if (scope.isGlobal) return true;
  return campusId != null && String(campusId) === String(scope.campusId);
}

async function loadLeadForScope(leadId, scope) {
  const { rows } = await db.query(
    'SELECT * FROM marketing_leads WHERE id = $1',
    [leadId]
  );
  if (!rows.length) return null;
  if (!assertCampusAccess(scope, rows[0].campus_id)) return false;
  return rows[0];
}

// Days after the initial form-link nudge to send follow-up reminders
const FORM_REMINDER_OFFSETS_DAYS = [3, 7];
const STAGE_COMPLETE = ['form_filled', 'enrolled', 'admission_paid', 'declined', 'lapsed', 'dead_lead'];

// The real admission application now lives on Ed Admin's site. The lead id is
// appended as `ref` so Ed Admin's completion webhook (POST
// /api/webhooks/edadmin/application-submitted, in server.js) can tell us
// which lead to move to 'form_filled'.
const EDADMIN_APPLICATION_URL = 'https://silverleafacademy.ed-space.net/onlineapplication.cfm';

async function sendApplicationLink(lead) {
  const childRef = lead.child_name || 'your child';
  const link = `${EDADMIN_APPLICATION_URL}?ref=${lead.id}`;
  const message = `Dear ${lead.parent_name}, congratulations! ${childRef} has passed the admission interview at Silverleaf Academy. Please complete the online admission application here: ${link} — this takes you straight to our admissions system, and our team is notified automatically once you submit it.`;

  if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message, fallbackPhone: lead.parent_phone });
  else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message });
  if (lead.parent_email) {
    sendEmail({
      to: lead.parent_email,
      subject: 'Complete Your Admission Application — Silverleaf Academy',
      html: `<p>Dear ${escapeHtml(lead.parent_name)}, congratulations! ${escapeHtml(childRef)} has passed the admission interview at Silverleaf Academy.</p><p>Please click below to complete the online admission application:</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p>This takes you straight to our admissions system — our team is notified automatically once you submit it.</p>`,
    });
  }

  await db.query(
    `INSERT INTO lead_form_reminders (lead_id, started_at, step, stopped, stopped_reason, updated_at)
     VALUES ($1, NOW(), 0, FALSE, NULL, NOW())
     ON CONFLICT (lead_id) DO UPDATE SET
       started_at = NOW(), step = 0, stopped = FALSE, stopped_reason = NULL, updated_at = NOW()`,
    [lead.id]
  );
}

// ── Admission form document upload ────────────────────────────
const uploadAdmissionForm = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
    ];
    cb(null, allowed.includes(file.mimetype) || /\.html?$/i.test(file.originalname));
  },
}).single('file');

function campusScope(scope, alias = '') {
  const a = alias ? `${alias}.` : '';
  return scope.isGlobal
    ? { where: '', params: [] }
    : { where: `WHERE ${a}campus_id = $1`, params: [scope.campusId] };
}

function parsePositiveId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Campus heads stay locked. Global users may pass ?campus_id= to slice one campus. */
function scopedCampus(scope, query = {}) {
  const id = scope.isGlobal ? parsePositiveId(query.campus_id) : (scope.campusId || null);
  return {
    id,
    params: id ? [id] : [],
    where(col = 'campus_id') { return id ? `WHERE ${col} = $1` : ''; },
    and(col = 'campus_id') { return id ? `AND ${col} = $1` : ''; },
  };
}

/** Campus / head-of-school view filters. Campus heads stay locked to their campus. */
function applyLeadViewFilters(scope, query, params, conds, alias = 'l.') {
  if (!scope.isGlobal) {
    params.push(scope.campusId);
    conds.push(`${alias}campus_id = $${params.length}`);
    return;
  }
  const campusId = parsePositiveId(query.campus_id);
  const headId = parsePositiveId(query.head_id);
  if (campusId) {
    params.push(campusId);
    conds.push(`${alias}campus_id = $${params.length}`);
  }
  if (headId) {
    params.push(headId);
    conds.push(`(
      ${alias}assigned_to = $${params.length}
      OR ${alias}campus_id = (
        SELECT campus_id FROM users
        WHERE id = $${params.length} AND role = 'campus_marketing_head'
      )
    )`);
  }
}

// ── DASHBOARD ───────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { scope } = req;
  const campus = scopedCampus(scope, req.query);
  const p  = campus.params;
  const cw = campus.where();
  const lw = campus.where('l.campus_id');

  try {
    const [funnel, sources, campaigns, social, events, campusBreakdown] = await Promise.all([
      db.query(
        `SELECT computed_stage, COUNT(*) AS count
         FROM marketing_leads ${cw} GROUP BY computed_stage`,
        p
      ),
      db.query(
        `SELECT source, COUNT(*) AS count
         FROM marketing_leads ${cw} GROUP BY source ORDER BY count DESC`,
        p
      ),
      db.query(
        `SELECT id, name, type, budget, spent, leads_generated, conversions, status
         FROM marketing_campaigns
         ${campus.id ? "WHERE status = 'active' AND (campus_id = $1 OR campus_id IS NULL)" : "WHERE status = 'active'"}
         ORDER BY created_at DESC LIMIT 5`,
        p
      ),
      db.query(
        `SELECT platform, SUM(followers) AS followers, SUM(reach) AS reach,
                ROUND(AVG(engagement_rate),2) AS engagement
         FROM social_analytics
         WHERE date >= CURRENT_DATE - INTERVAL '30 days' ${campus.and()}
         GROUP BY platform`,
        p
      ),
      db.query(
        `SELECT * FROM school_events
         WHERE start_date >= CURRENT_DATE
           AND audience IN ('marketing','all')
           AND event_type = ANY($${p.length + 1})
           ${campus.id ? 'AND (campus_id = $1 OR campus_id IS NULL)' : ''}
         ORDER BY start_date LIMIT 5`,
        [...p, ['open_day', 'enrolment_window', 'term_start', 'term_end']]
      ),
      scope.isGlobal ? db.query(
        `SELECT c.id, c.name, c.code,
                COUNT(DISTINCT l.id) AS total_leads,
                COUNT(DISTINCT l.id) FILTER (WHERE l.computed_stage = 'admission_paid') AS paid,
                COUNT(DISTINCT l.id) FILTER (WHERE l.computed_stage = 'form_filled')   AS forms,
                COUNT(DISTINCT tb.id) AS total_tours
         FROM campuses c
         LEFT JOIN marketing_leads l  ON l.campus_id = c.id
         LEFT JOIN tour_bookings   tb ON tb.campus_id = c.id
         ${campus.id ? 'WHERE c.id = $1' : ''}
         GROUP BY c.id, c.name, c.code ORDER BY c.name`,
        campus.params
      ) : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      funnel:          funnel.rows,
      sources:         sources.rows,
      activeCampaigns: campaigns.rows,
      social:          social.rows,
      upcomingEvents:  events.rows,
      campusBreakdown: campusBreakdown.rows,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

/** Live funnel metrics aligned with the Master Dashboard workbook (Feb 2026). */
async function queryLiveFunnelMetrics(scope, query = {}) {
  const campus = scopedCampus(scope, query);
  const p = campus.params;
  const cw = campus.where();
  const lwWhere = campus.where('l.campus_id');

  const [cluster, interviews, campusFunnel, social, socialSources, funnelStages] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::int AS total_leads,
         COUNT(*) FILTER (WHERE computed_stage = 'interested_lead')::int AS interested,
         COUNT(*) FILTER (WHERE computed_stage = 'tour_booked')::int AS tour_booked,
         COUNT(*) FILTER (WHERE computed_stage = 'interview_booked')::int AS interview_booked,
         COUNT(*) FILTER (WHERE computed_stage = 'form_filled')::int AS registered,
         COUNT(*) FILTER (WHERE computed_stage = 'enrolled')::int AS enrolled,
         COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS admission_paid,
         COUNT(*) FILTER (WHERE computed_stage = 'dead_lead')::int AS dead_leads,
         COUNT(*) FILTER (WHERE computed_stage NOT IN ('declined','lapsed'))::int AS active_leads
       FROM marketing_leads ${cw ? `${cw} AND` : 'WHERE'} is_archived = FALSE`,
      p
    ),
    db.query(
      `SELECT
         COUNT(DISTINCT ib.lead_id) FILTER (
           WHERE ib.outcome = 'passed'
             AND l.computed_stage IN ('interview_booked', 'form_filled')
         )::int AS passed,
         COUNT(DISTINCT ib.lead_id) FILTER (
           WHERE ib.outcome = 'failed'
             AND l.computed_stage IN ('interview_booked', 'dead_lead', 'declined')
         )::int AS failed,
         COUNT(DISTINCT ib.lead_id) FILTER (
           WHERE COALESCE(ib.outcome, 'pending') = 'pending'
             AND l.computed_stage = 'interview_booked'
         )::int AS pending
       FROM interview_bookings ib
       JOIN marketing_leads l ON l.id = ib.lead_id
       ${lwWhere}`,
      p
    ),
    scope.isGlobal
      ? db.query(
          `SELECT c.id, c.code, c.name,
                  COUNT(l.id)::int AS total_leads,
                  COUNT(*) FILTER (WHERE l.computed_stage = 'interested_lead')::int AS interested,
                  COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS admission_paid,
                  COUNT(*) FILTER (WHERE l.computed_stage = 'form_filled')::int AS registered,
                  COUNT(*) FILTER (WHERE l.computed_stage = 'dead_lead')::int AS dead_leads,
                  (SELECT COUNT(DISTINCT ib.lead_id)::int FROM interview_bookings ib
                   JOIN marketing_leads l2 ON l2.id = ib.lead_id
                   WHERE l2.campus_id = c.id AND ib.outcome = 'passed'
                     AND l2.computed_stage IN ('interview_booked', 'form_filled')) AS passed_interview,
                  (SELECT COUNT(DISTINCT ib.lead_id)::int FROM interview_bookings ib
                   JOIN marketing_leads l2 ON l2.id = ib.lead_id
                   WHERE l2.campus_id = c.id AND ib.outcome = 'failed'
                     AND l2.computed_stage IN ('interview_booked', 'dead_lead', 'declined')) AS failed_interview
           FROM campuses c
           LEFT JOIN marketing_leads l ON l.campus_id = c.id AND l.is_archived = FALSE
           ${campus.id ? 'WHERE c.id = $1' : ''}
           GROUP BY c.id, c.code, c.name
           ORDER BY c.name`,
          campus.params
        )
      : Promise.resolve({ rows: [] }),
    db.query(
      `SELECT platform,
              MAX(followers)::int AS followers,
              ROUND(AVG(engagement_rate), 2) AS engagement,
              SUM(posts_count)::int AS posts_count,
              SUM(reach)::int AS reach,
              MAX(date) AS latest_date,
              BOOL_OR(source IN ('buffer','puffer')) AS from_buffer
       FROM social_analytics
       WHERE date >= DATE_TRUNC('month', CURRENT_DATE)::date
         ${campus.id ? 'AND (campus_id = $1 OR campus_id IS NULL)' : ''}
       GROUP BY platform
       ORDER BY platform`,
      p
    ),
    db.query(
      `SELECT source, COUNT(*)::int AS snapshots
       FROM social_analytics
       WHERE date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY source`
    ),
    db.query(
      `SELECT computed_stage, COUNT(*)::int AS count
       FROM marketing_leads ${cw ? `${cw} AND` : 'WHERE'} is_archived = FALSE
       GROUP BY computed_stage`,
      p
    ),
  ]);

  const c = cluster.rows[0] || {};
  const iv = interviews.rows[0] || {};
  const totalLeads = c.total_leads || 0;
  const admissionPaid = c.admission_paid || 0;

  return {
    total_leads: totalLeads,
    active_leads: c.active_leads || 0,
    interested: c.interested || 0,
    tour_booked: c.tour_booked || 0,
    interview_booked: c.interview_booked || 0,
    passed_interview: iv.passed || 0,
    failed_interview: iv.failed || 0,
    pending_interview: iv.pending || 0,
    registered: c.registered || 0,
    enrolled: c.enrolled || 0,
    admission_paid: admissionPaid,
    dead_leads: c.dead_leads || 0,
    conversion_rate: totalLeads ? Math.round((admissionPaid / totalLeads) * 1000) / 10 : 0,
    funnel: funnelStages.rows,
    campus_funnel: campusFunnel.rows,
    buffer_kpi: {
      platforms: social.rows,
      data_sources: socialSources.rows,
      connected: buffer.isConfigured() || socialSources.rows.some((r) => r.source === 'buffer' || r.source === 'puffer'),
      configured: buffer.isConfigured(),
    },
    refreshed_at: new Date().toISOString(),
  };
}

function buildSnapshotVariance(snapshot, live) {
  const sheet = snapshot?.cluster || {};
  return {
    total_leads: (live.total_leads || 0) - (sheet.total_leads || 0),
    admission_paid: (live.admission_paid || 0) - (sheet.enrolled_admission_paid || 0),
    interested: (live.interested || 0) - (sheet.interested_leads || 0),
    dead_leads: (live.dead_leads || 0) - (sheet.dead_leads || 0),
    passed_interview: (live.passed_interview || 0) - (sheet.passed_interview || 0),
    failed_interview: (live.failed_interview || 0) - (sheet.failed_interview || 0),
    registered: (live.registered || 0) - (sheet.registered_form_filled || 0),
  };
}

function loadMasterSnapshotFile() {
  const file = path.join(__dirname, '..', 'data', 'marketing-master-dashboard-2026.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Master Marketing Dashboard workbook targets (Feb 2026) vs live DB counts
router.get('/master-snapshot', async (req, res) => {
  try {
    const snapshot = loadMasterSnapshotFile();
    const live = await queryLiveFunnelMetrics(req.scope, req.query);
    const rate = snapshot.commission_rules?.staff_referral_tzs || 25000;
    const [campaignCount, commissions] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS n FROM marketing_campaigns'),
      db.query(
        `SELECT COALESCE(NULLIF(source_detail, ''), 'Uncredited referral') AS referrer,
                COUNT(*)::int AS students,
                COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS paid,
                (COUNT(*) FILTER (WHERE computed_stage = 'admission_paid') * $1)::int AS amount_tzs
         FROM marketing_leads
         WHERE is_archived = FALSE AND source IN ('referral', 'partner_school')
         GROUP BY 1
         ORDER BY paid DESC, students DESC`,
        [rate]
      ),
    ]);

    res.json({
      snapshot,
      live: {
        ...live,
        campaigns: campaignCount.rows[0]?.n || 0,
      },
      variance: buildSnapshotVariance(snapshot, live),
      enrollment: {
        target_2026: snapshot.cluster?.target_enrollment_2026 || 0,
        live_paid: live.admission_paid || 0,
        sheet_paid: snapshot.cluster?.enrolled_admission_paid || 0,
        progress_pct: snapshot.cluster?.target_enrollment_2026
          ? Math.round(((live.admission_paid || 0) / snapshot.cluster.target_enrollment_2026) * 1000) / 10
          : 0,
        company_occupancy_pct: snapshot.enrollment_targets?.company_occupancy_pct || 0,
        company_total_enrolled: snapshot.enrollment_targets?.company_total_enrolled || 0,
        company_target_seats: snapshot.enrollment_targets?.company_target_seats || 0,
      },
      ops: {
        occupancy_by_grade: snapshot.occupancy_by_grade || null,
        campus_occupancy: snapshot.campus_occupancy || null,
        sis_occupancy: await edadmin.occupancyByGrade().catch(() => null),
        dropouts: snapshot.dropouts_ytd || null,
        retained: snapshot.retained_vs_new || null,
        weekly_leads: snapshot.weekly_leads_by_month || null,
        weekly_enrollment: snapshot.weekly_enrollment_by_month || null,
        weekly_ops: snapshot.weekly_ops_11_15_may_2026 || null,
        top_sheet_kpis: snapshot.top_sheet_kpis || null,
        commission_rules: snapshot.commission_rules || null,
        commissions_live: commissions.rows,
        social_weekly: snapshot.social_weekly_april_2026 || null,
        formulas: snapshot.formulas_summary || null,
      },
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Premium marketing report bundle (live funnel + sheet targets + campaigns + Buffer KPIs)
router.get('/reports/premium', async (req, res) => {
  const { scope } = req;
  const { period = 'monthly' } = req.query;
  const campus = scopedCampus(scope, req.query);
  const p = campus.params;
  const cw = campus.where('campus_id');
  const interval = { daily: '1 day', weekly: '7 days', monthly: '30 days', yearly: '365 days' }[period] || '30 days';

  try {
    const snapshot = loadMasterSnapshotFile();
    const live = await queryLiveFunnelMetrics(scope, req.query);

    const [sources, campaigns, trend, periodFunnel] = await Promise.all([
      db.query(
        `SELECT source, COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS conversions
         FROM marketing_leads l ${cw ? `${cw} AND` : 'WHERE'} created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY source ORDER BY count DESC`,
        p
      ),
      db.query(
        `SELECT name, type, budget, spent, leads_generated, conversions, status
         FROM marketing_campaigns
         WHERE status != 'draft' ${campus.id ? 'AND (campus_id = $1 OR campus_id IS NULL)' : ''}
         ORDER BY spent DESC`,
        p
      ),
      db.query(
        `SELECT DATE_TRUNC('week', l.created_at) AS period,
                COUNT(*)::int AS leads,
                COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid
         FROM marketing_leads l
         ${cw ? `${cw} AND` : 'WHERE'} l.created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY 1 ORDER BY 1`,
        p
      ),
      db.query(
        `SELECT computed_stage, COUNT(*)::int AS count
         FROM marketing_leads
         ${cw ? `${cw} AND` : 'WHERE'} created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY computed_stage`,
        p
      ),
    ]);

    res.json({
      period,
      generated_at: new Date().toISOString(),
      snapshot,
      live,
      variance: buildSnapshotVariance(snapshot, live),
      enrollment: {
        target_2026: snapshot.cluster?.target_enrollment_2026 || 0,
        live_paid: live.admission_paid || 0,
        progress_pct: snapshot.cluster?.target_enrollment_2026
          ? Math.round(((live.admission_paid || 0) / snapshot.cluster.target_enrollment_2026) * 1000) / 10
          : 0,
      },
      period_stats: {
        funnel: periodFunnel.rows,
        sources: sources.rows,
        trend: trend.rows,
      },
      campaigns: campaigns.rows,
      social_targets: snapshot.social_following?.filter(r => r.month === 2 && r.year === 2026) || [],
      social_output: snapshot.social_output?.filter(r => r.month === 2) || [],
      leads_summary: await (async () => {
        const baseWhere = scope.isGlobal ? 'WHERE is_archived = FALSE' : 'WHERE campus_id = $1 AND is_archived = FALSE';
        const [stages, totals, src] = await Promise.all([
          db.query(`SELECT computed_stage, COUNT(*)::int AS count FROM marketing_leads ${baseWhere} GROUP BY computed_stage ORDER BY count DESC`, p),
          db.query(`SELECT COUNT(*)::int AS total,
                           COUNT(*) FILTER (WHERE computed_stage NOT IN ('declined','lapsed'))::int AS active,
                           COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS paid,
                           COUNT(*) FILTER (WHERE computed_stage = 'dead_lead')::int AS dead,
                           COUNT(*) FILTER (WHERE computed_stage IN ('declined','lapsed'))::int AS declined
                    FROM marketing_leads ${baseWhere}`, p),
          db.query(`SELECT source, COUNT(*)::int AS count FROM marketing_leads ${baseWhere} GROUP BY source ORDER BY count DESC`, p),
        ]);
        return { totals: totals.rows[0], stages: stages.rows, sources: src.rows };
      })(),
      leads_register: (await db.query(
        `SELECT l.parent_name, l.child_name, l.parent_phone, l.interested_class,
                l.computed_stage, l.source, c.name AS campus_name, l.lead_score,
                l.created_at::date AS created_date
         FROM marketing_leads l
         LEFT JOIN campuses c ON c.id = l.campus_id
         ${scope.isGlobal ? 'WHERE l.is_archived = FALSE' : 'WHERE l.campus_id = $1 AND l.is_archived = FALSE'}
         ORDER BY l.updated_at DESC LIMIT 500`,
        p
      )).rows,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── LEADS ───────────────────────────────────────────────────
const LEAD_LIST_SQL = `
  SELECT l.*, c.name AS campus_name,
         u.name AS assigned_name,
         creator.name AS created_by_name,
         mc.name AS campaign_name,
         EXISTS(SELECT 1 FROM tour_bookings WHERE lead_id = l.id) AS has_tour,
         EXISTS(SELECT 1 FROM admission_applications WHERE lead_id = l.id) AS has_application,
         EXISTS(SELECT 1 FROM admission_payments WHERE lead_id = l.id) AS has_payment,
         (li.id IS NOT NULL) AS has_interview,
         li.id AS interview_id, li.outcome AS interview_outcome,
         li.interview_date, li.interview_time,
         (SELECT COUNT(*)::int FROM tour_bookings t WHERE t.lead_id = l.id AND t.status = 'no_show') AS tour_no_shows,
         (SELECT COUNT(*)::int FROM follow_up_tasks ft WHERE ft.lead_id = l.id AND ft.status = 'done') AS followups_done,
         (SELECT step FROM lead_form_reminders r WHERE r.lead_id = l.id) AS form_reminder_step
  FROM marketing_leads l
  LEFT JOIN campuses c ON l.campus_id = c.id
  LEFT JOIN users u ON l.assigned_to = u.id
  LEFT JOIN users creator ON l.created_by = creator.id
  LEFT JOIN marketing_campaigns mc ON l.campaign_id = mc.id
  LEFT JOIN LATERAL (
    SELECT id, outcome, interview_date, interview_time
    FROM interview_bookings WHERE lead_id = l.id
    ORDER BY created_at DESC LIMIT 1
  ) li ON TRUE`;

const LEAD_DETAIL_SQL = LEAD_LIST_SQL;
const VITALITY_FILTERS = new Set(['hot', 'warm', 'cold', 'dead']);
const SMOKE_LEAD_SQL = `l.parent_name NOT ILIKE 'Smoke %'
  AND l.parent_name NOT ILIKE 'Live Parent %'
  AND COALESCE(l.child_name, '') NOT ILIKE 'Smoke %'`;

function tallyVitality(rows) {
  const vitality = { hot: 0, warm: 0, cold: 0, dead: 0 };
  let overdue = 0;
  for (const row of rows) {
    const stage = row.computed_stage || '';
    if (!['declined', 'lapsed', 'admission_paid', 'enrolled'].includes(stage)) {
      const status = computeLeadVitality(row).status;
      if (vitality[status] != null) vitality[status] += 1;
    }
    if (isFollowUpOverdue(row)) overdue += 1;
  }
  return { vitality, overdue };
}

const LEAD_EXPORT_MAX = 10000;

/** Shared campus / search / stage filters for the leads list and export sheet. */
function buildLeadListFilters(scope, query) {
  const { stage, source, assigned_to, search, exclude_stages, overdue, vitality, created_by } = query;
  const vitalityKey = String(vitality || '').toLowerCase();
  const filterVitality = VITALITY_FILTERS.has(vitalityKey);
  const params = [];
  const conds = [];

  applyLeadViewFilters(scope, query, params, conds);
  if (stage)       { params.push(stage);       conds.push(`l.computed_stage = $${params.length}`); }
  if (source)      { params.push(source);      conds.push(`l.source = $${params.length}`); }
  if (assigned_to) { params.push(assigned_to); conds.push(`l.assigned_to = $${params.length}`); }
  if (String(created_by).toLowerCase() === 'none') {
    conds.push('l.created_by IS NULL');
  } else {
    const createdBy = parsePositiveId(created_by);
    if (createdBy) {
      params.push(createdBy);
      conds.push(`l.created_by = $${params.length}`);
    }
  }
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(l.parent_name ILIKE $${params.length} OR l.child_name ILIKE $${params.length} OR l.parent_phone ILIKE $${params.length})`);
  }
  if (exclude_stages) {
    const skip = String(exclude_stages).split(',').map((s) => s.trim()).filter(Boolean);
    if (skip.length) {
      params.push(skip);
      conds.push(`l.computed_stage <> ALL($${params.length}::text[])`);
    }
  }
  if (String(overdue) === '1' || String(overdue) === 'true') {
    conds.push(`l.computed_stage NOT IN ('admission_paid','enrolled','declined','lapsed','dead_lead')`);
    conds.push(`(
      (l.follow_up_date IS NOT NULL AND l.follow_up_date < CURRENT_DATE)
      OR (l.follow_up_date IS NULL AND COALESCE(l.last_contacted_at, l.created_at, l.updated_at) < NOW() - INTERVAL '7 days')
    )`);
  }
  conds.push(`l.is_archived = FALSE`);
  conds.push(SMOKE_LEAD_SQL);

  return { params, conds, vitalityKey, filterVitality };
}

async function queryLeadsForExport(scope, query, maxRows = LEAD_EXPORT_MAX) {
  const { params, conds, vitalityKey, filterVitality } = buildLeadListFilters(scope, query);
  const where = 'WHERE ' + conds.join(' AND ');
  const { rows } = await db.query(
    `${LEAD_LIST_SQL} ${where} ORDER BY l.lead_score DESC, l.updated_at DESC`,
    params
  );
  let matched = rows.map(attachVitality);
  if (filterVitality) {
    matched = matched.filter((l) => l.vitality?.status === vitalityKey);
  }
  const truncated = matched.length > maxRows;
  return {
    data: truncated ? matched.slice(0, maxRows) : matched,
    total: matched.length,
    truncated,
  };
}

router.get('/campus-heads', async (req, res) => {
  const { scope } = req;
  const params = [];
  const conds = [`u.role = 'campus_marketing_head'`, 'u.is_active = TRUE'];
  if (!scope.isGlobal) {
    params.push(scope.campusId);
    conds.push(`u.campus_id = $${params.length}`);
  }
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.campus_id, c.name AS campus_name, c.code AS campus_code
       FROM users u
       LEFT JOIN campuses c ON c.id = u.campus_id
       WHERE ${conds.join(' AND ')}
       ORDER BY c.name NULLS LAST, u.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/leads', async (req, res) => {
  const { scope } = req;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const { params, conds, vitalityKey, filterVitality } = buildLeadListFilters(scope, req.query);
  const where = 'WHERE ' + conds.join(' AND ');

  try {
    if (filterVitality) {
      const { rows } = await db.query(
        `${LEAD_LIST_SQL} ${where} ORDER BY l.lead_score DESC, l.updated_at DESC`,
        params
      );
      const matched = rows.map(attachVitality).filter((l) => l.vitality?.status === vitalityKey);
      return res.json({
        data: matched.slice(offset, offset + limit),
        total: matched.length,
        page,
        limit,
      });
    }

    params.push(limit, offset);
    const [leads, total] = await Promise.all([
      db.query(
        `${LEAD_LIST_SQL}
         ${where}
         ORDER BY l.lead_score DESC, l.updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      db.query(
        `SELECT COUNT(*) FROM marketing_leads l ${where}`,
        params.slice(0, -2)
      ),
    ]);

    res.json({ data: leads.rows.map(attachVitality), total: parseInt(total.rows[0].count), page: +page, limit: +limit });
  } catch (err) {
    return sendServerError(res, err);
  }
});

async function fetchLeadDetail(leadId) {
  const { rows } = await db.query(`${LEAD_DETAIL_SQL} WHERE l.id = $1`, [leadId]);
  return attachVitality(rows[0] || null);
}

// Funnel summary for leads page export
router.get('/leads/report/summary', async (req, res) => {
  const { scope } = req;
  const params = [];
  const conds = ['l.is_archived = FALSE', SMOKE_LEAD_SQL];
  applyLeadViewFilters(scope, req.query, params, conds);
  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const [stages, totals, sources, vitalityRows] = await Promise.all([
      db.query(
        `SELECT l.computed_stage, COUNT(*)::int AS count
         FROM marketing_leads l ${where}
         GROUP BY l.computed_stage ORDER BY count DESC`,
        params
      ),
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE l.computed_stage NOT IN ('declined','lapsed'))::int AS active,
           COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid,
           COUNT(*) FILTER (WHERE l.computed_stage = 'dead_lead')::int AS dead,
           COUNT(*) FILTER (WHERE l.computed_stage IN ('declined','lapsed'))::int AS declined
         FROM marketing_leads l ${where}`,
        params
      ),
      db.query(
        `SELECT l.source, COUNT(*)::int AS count
         FROM marketing_leads l ${where}
         GROUP BY l.source ORDER BY count DESC`,
        params
      ),
      db.query(`${LEAD_LIST_SQL} ${where}`, params),
    ]);

    const tallied = tallyVitality(vitalityRows.rows);

    res.json({
      generated_at: new Date().toISOString(),
      totals: { ...totals.rows[0], overdue: tallied.overdue },
      stages: stages.rows,
      sources: sources.rows,
      vitality: tallied.vitality,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/leads/entered-by', async (req, res) => {
  const { scope } = req;
  const params = [];
  const conds = ['l.is_archived = FALSE', SMOKE_LEAD_SQL];
  applyLeadViewFilters(scope, req.query, params, conds);
  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const { rows } = await db.query(
      `SELECT
         l.created_by,
         COALESCE(MAX(u.name), 'Unknown / online form') AS name,
         MAX(u.email) AS email,
         STRING_AGG(DISTINCT c.name, ', ') AS campuses,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE l.computed_stage NOT IN ('declined','lapsed'))::int AS active,
         COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid,
         COUNT(*) FILTER (WHERE l.created_at >= date_trunc('month', CURRENT_TIMESTAMP))::int AS this_month
       FROM marketing_leads l
       LEFT JOIN users u ON u.id = l.created_by
       LEFT JOIN campuses c ON c.id = l.campus_id
       ${where}
       GROUP BY l.created_by
       ORDER BY total DESC, name ASC`,
      params
    );
    res.json({
      generated_at: new Date().toISOString(),
      data: rows,
      total: rows.reduce((sum, row) => sum + (row.total || 0), 0),
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/leads/export', async (req, res) => {
  try {
    const result = await queryLeadsForExport(req.scope, req.query);
    res.json({
      generated_at: new Date().toISOString(),
      total: result.total,
      truncated: result.truncated,
      data: result.data,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/leads/:id', async (req, res) => {
  try {
    const access = await loadLeadForScope(req.params.id, req.scope);
    if (access === null) return res.status(404).json({ error: 'Lead not found.' });
    if (access === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });
    const lead = await fetchLeadDetail(req.params.id);
    res.json(lead);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.put('/leads/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const {
    parent_name, parent_phone, parent_email, whatsapp_number,
    child_name, child_age, interested_class, boarding_day,
    source, campaign_id, notes, follow_up_date, campus_id,
    parent_phone2, occupation, residence, region, child_gender,
    num_children, how_heard, source_detail, intended_term, assigned_to,
  } = req.body;

  if (!parent_name?.trim()) return res.status(400).json({ error: 'Parent name is required.' });
  if (!parent_phone?.trim()) return res.status(400).json({ error: 'Parent phone is required.' });
  if (!child_name?.trim()) return res.status(400).json({ error: 'Child name is required.' });
  if (!interested_class?.trim()) return res.status(400).json({ error: 'Interested class is required.' });
  const phoneDigits = String(parent_phone).replace(/\D/g, '');
  if (phoneDigits.length < 9) return res.status(400).json({ error: 'Enter a valid phone number (at least 9 digits).' });

  try {
    const existing = await loadLeadForScope(req.params.id, req.scope);
    if (existing === null) return res.status(404).json({ error: 'Lead not found.' });
    if (existing === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const campusId = req.scope.isGlobal ? (campus_id || existing.campus_id) : req.scope.campusId;
    const phoneChanged = String(parent_phone).trim() !== String(existing.parent_phone || '').trim()
      || String(campusId) !== String(existing.campus_id);
    const siblingFlag = phoneChanged
      ? await siblingFlagForPhone(parent_phone, campusId)
      : existing.sibling_flag;

    await db.query(
      `UPDATE marketing_leads SET
         campus_id = $1,
         parent_name = $2,
         parent_phone = $3,
         parent_email = $4,
         whatsapp_number = $5,
         child_name = $6,
         child_age = $7,
         interested_class = $8,
         boarding_day = $9,
         source = COALESCE($10, source),
         campaign_id = $11,
         notes = COALESCE($12, notes),
         follow_up_date = $13,
         parent_phone2 = $15,
         occupation = $16,
         residence = $17,
         region = $18,
         child_gender = $19,
         num_children = $20,
         how_heard = $21,
         source_detail = $22,
         intended_term = $23,
         sibling_flag = $24,
         assigned_to = $25,
         updated_at = NOW()
       WHERE id = $14`,
      [
        campusId, parent_name.trim(), parent_phone.trim(), parent_email || null,
        whatsapp_number || null, child_name.trim(),
        child_age === '' || child_age === undefined ? null : child_age,
        interested_class.trim(), boarding_day || 'day',
        source || null, campaign_id || null, notes ?? null,
        follow_up_date || null, req.params.id,
        parent_phone2 || null, occupation || null, residence || null, region || null,
        child_gender || null,
        num_children === '' || num_children === undefined ? null : num_children,
        how_heard || null, source_detail || null, intended_term || null,
        siblingFlag,
        Object.prototype.hasOwnProperty.call(req.body, 'assigned_to')
          ? (assigned_to || null)
          : (existing.assigned_to || null),
      ]
    );

    const lead = await fetchLeadDetail(req.params.id);
    res.json({ success: true, lead });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.delete('/leads/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const lead = await loadLeadForScope(req.params.id, req.scope);
    if (lead === null) return res.status(404).json({ error: 'Lead not found.' });
    if (lead === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    await db.query(
      'UPDATE marketing_leads SET is_archived = TRUE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true, message: 'Lead archived.' });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/leads', requireRole(...MARKETING_ROLES), async (req, res) => {
  const {
    campus_id, parent_name, parent_phone, parent_email, whatsapp_number,
    child_name, child_age, child_gender, interested_class, boarding_day,
    source, source_detail, campaign_id, notes, how_heard,
    parent_phone2, occupation, residence, region, num_children, intended_term, assigned_to,
  } = req.body;

  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;
  const createError = validateLeadCreate(req.body, campusId);
  if (createError) return res.status(400).json({ error: createError });

  try {
    const siblingFlag = await siblingFlagForPhone(parent_phone, campusId);

    const { rows } = await db.query(
      `INSERT INTO marketing_leads
         (campus_id, created_by, parent_name, parent_phone, parent_email, whatsapp_number,
          child_name, child_age, child_gender, interested_class, boarding_day,
          source, source_detail, campaign_id, notes, how_heard,
          sibling_flag, assigned_to,
          parent_phone2, occupation, residence, region, num_children, intended_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [campusId, req.user.id, parent_name, parent_phone, parent_email, whatsapp_number,
       child_name.trim(), child_age === '' || child_age === undefined ? null : child_age, child_gender, interested_class.trim(), boarding_day,
       source || 'walk_in', source_detail, campaign_id || null, notes, how_heard,
       siblingFlag, assigned_to || req.user.id,
       parent_phone2 || null, occupation || null, residence || null, region || null,
       num_children === '' || num_children === undefined ? 1 : num_children,
       intended_term || null]
    );

    if (campaign_id) {
      await db.query('UPDATE marketing_campaigns SET leads_generated = leads_generated + 1 WHERE id = $1', [campaign_id]);
    }

    res.json({ success: true, lead: attachVitality(rows[0]) });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/readiness', async (req, res) => {
  try {
    const snap = readiness.snapshot();
    let edadminProbe = { configured: edadmin.isConfigured() };
    if (edadmin.isConfigured()) {
      try {
        edadminProbe = { configured: true, parent_records: await edadmin.parentCount() };
      } catch (err) {
        edadminProbe = { configured: true, reachable: false, error: err.message };
      }
    }
    res.json({
      ...snap,
      edadmin: edadminProbe,
      endpoints: {
        parents: `${edadmin.apiBase()}/api/general/v1/Parents`,
        students: `${edadmin.apiBase()}/api/general/v1/Students`,
      },
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/sis/sync', requireRole(...MARKETING_ROLES), async (_req, res) => {
  try {
    const result = await edadmin.syncDirectory(db);
    res.json({ success: true, ...result });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/sis/parents', async (req, res) => {
  try {
    const parentId = req.query.parent_id || req.query.id;
    if (parentId) {
      const { rows } = await db.query(
        `SELECT p.*,
                (SELECT COUNT(*)::int FROM edadmin_students s WHERE s.parent_edadmin_id = p.edadmin_id) AS student_count
         FROM edadmin_parents p WHERE p.edadmin_id = $1`,
        [String(parentId)]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Parent not found. Sync first or check parent_id.' });
      const kids = await db.query(
        'SELECT * FROM edadmin_students WHERE parent_edadmin_id = $1 ORDER BY last_name, first_name',
        [String(parentId)]
      );
      return res.json({ parent: rows[0], students: kids.rows });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const [list, count] = await Promise.all([
      db.query(
        `SELECT p.*,
                (SELECT COUNT(*)::int FROM edadmin_students s WHERE s.parent_edadmin_id = p.edadmin_id) AS student_count
         FROM edadmin_parents p
         ORDER BY p.full_name NULLS LAST, p.edadmin_id
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query('SELECT COUNT(*)::int AS n FROM edadmin_parents'),
    ]);
    res.json({ data: list.rows, total: count.rows[0].n, page, limit });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/sis/parents/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM edadmin_students s WHERE s.parent_edadmin_id = p.edadmin_id) AS student_count
       FROM edadmin_parents p WHERE p.edadmin_id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Parent not found.' });
    const kids = await db.query(
      'SELECT * FROM edadmin_students WHERE parent_edadmin_id = $1 ORDER BY last_name, first_name',
      [req.params.id]
    );
    res.json({ parent: rows[0], students: kids.rows });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/sis/students', async (req, res) => {
  try {
    const parentId = req.query.parent_id;
    const params = [];
    const where = [];
    if (parentId) {
      params.push(String(parentId));
      where.push(`parent_edadmin_id = $${params.length}`);
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const sql = `SELECT * FROM edadmin_students
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY last_name, first_name LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const countSql = `SELECT COUNT(*)::int AS n FROM edadmin_students ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
    const [list, count] = await Promise.all([
      db.query(sql, params),
      db.query(countSql, params.slice(0, -2)),
    ]);
    res.json({ data: list.rows, total: count.rows[0].n, page, limit, parent_id: parentId || null });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/agent/queue', async (req, res) => {
  try {
    const queue = await agentLoop.buildQueue(req.scope, Number(req.query.limit) || 40, req.query);
    res.json({ data: queue, total: queue.length });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/agent/actions', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const campus = scopedCampus(req.scope, req.query);
    const params = [status];
    const campusSql = campus.id ? ' AND a.campus_id = $2' : '';
    if (campus.id) params.push(campus.id);
    const { rows } = await db.query(
      `SELECT a.*, l.parent_name, l.child_name, l.parent_phone, l.computed_stage
       FROM agent_actions a
       JOIN marketing_leads l ON l.id = a.lead_id
       WHERE a.status = $1 ${campusSql}
       ORDER BY a.created_at DESC
       LIMIT 80`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/agent/propose', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { lead_id, action_type, notes } = req.body;
  if (!lead_id) return res.status(400).json({ error: 'lead_id is required.' });
  try {
    const access = await loadLeadForScope(lead_id, req.scope);
    if (access === null) return res.status(404).json({ error: 'Lead not found.' });
    if (access === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });
    const lead = await agentLoop.loadLead(lead_id);
    const action = await agentLoop.propose({
      lead,
      actionType: action_type || agentLoop.defaultActionType(lead),
      proposedBy: req.user.id,
      notes,
    });
    res.json({ success: true, action });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return sendServerError(res, err);
  }
});

router.post('/agent/actions/:id/approve', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const action = await agentLoop.review({
      actionId: req.params.id,
      reviewerId: req.user.id,
      decision: 'approve',
      scope: req.scope,
    });
    res.json({ success: true, action });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return sendServerError(res, err);
  }
});

router.post('/agent/actions/:id/reject', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const action = await agentLoop.review({
      actionId: req.params.id,
      reviewerId: req.user.id,
      decision: 'reject',
      scope: req.scope,
    });
    res.json({ success: true, action });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return sendServerError(res, err);
  }
});

router.get('/feeder-schools', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, location, type FROM feeder_schools ORDER BY name');
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/leads/:id/contacts', async (req, res) => {
  try {
    const access = await loadLeadForScope(req.params.id, req.scope);
    if (access === null) return res.status(404).json({ error: 'Lead not found.' });
    if (access === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });
    const { rows } = await db.query(
      `SELECT a.*, u.name AS created_name
       FROM lead_contact_attempts a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC
       LIMIT 40`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/leads/:id/contacts', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { channel, outcome, notes } = req.body;
  const allowedChannel = ['phone', 'whatsapp', 'email', 'sms', 'in_person', 'dm'];
  const allowedOutcome = ['replied', 'no_answer', 'invalid', 'callback', 'left_message', 'declined_talk'];
  if (!allowedChannel.includes(channel)) return res.status(400).json({ error: 'Pick a contact channel.' });
  if (!allowedOutcome.includes(outcome)) return res.status(400).json({ error: 'Pick what happened.' });

  try {
    const access = await loadLeadForScope(req.params.id, req.scope);
    if (access === null) return res.status(404).json({ error: 'Lead not found.' });
    if (access === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const { rows } = await db.query(
      `INSERT INTO lead_contact_attempts (lead_id, channel, outcome, notes, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, channel, outcome, notes || null, req.user.id]
    );

    const deadReason = outcome === 'invalid'
      ? 'Phone / WhatsApp invalid'
      : outcome === 'declined_talk'
        ? 'Parent declined to talk'
        : null;

    await db.query(
      `UPDATE marketing_leads SET
         last_contacted_at = NOW(),
         last_contact_channel = $2::varchar,
         last_contact_outcome = $3::varchar,
         updated_at = NOW(),
         dead_reason = COALESCE($4::varchar, dead_reason),
         computed_stage = CASE
           WHEN $3::text = 'invalid' AND computed_stage = 'interested_lead' THEN 'dead_lead'
           ELSE computed_stage
         END
       WHERE id = $1::int`,
      [req.params.id, channel, outcome, deadReason]
    );

    const lead = await fetchLeadDetail(req.params.id);
    res.json({ success: true, contact: rows[0], lead });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/leads/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { notes, follow_up_date, assigned_to, decline_reason, is_archived } = req.body;
  try {
    const lead = await loadLeadForScope(req.params.id, req.scope);
    if (lead === null) return res.status(404).json({ error: 'Lead not found.' });
    if (lead === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const assigned = Object.prototype.hasOwnProperty.call(req.body, 'assigned_to')
      ? (assigned_to || null)
      : lead.assigned_to;

    const { rows } = await db.query(
      `UPDATE marketing_leads SET
         notes         = COALESCE($1, notes),
         follow_up_date= COALESCE($2, follow_up_date),
         assigned_to   = $3,
         decline_reason= COALESCE($4, decline_reason),
         is_archived   = COALESCE($5, is_archived),
         updated_at    = NOW()
       WHERE id = $6 RETURNING *`,
      [notes, follow_up_date, assigned, decline_reason, is_archived, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ success: true, lead: rows[0] });
  } catch (err) {
    console.error('Patch lead error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Mark lead as declined or lapsed
router.patch('/leads/:id/status', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { status, reason } = req.body;
  if (!['declined', 'lapsed'].includes(status))
    return res.status(400).json({ error: 'Status must be declined or lapsed.' });
  try {
    const lead = await loadLeadForScope(req.params.id, req.scope);
    if (lead === null) return res.status(404).json({ error: 'Lead not found.' });
    if (lead === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const { rows } = await db.query(
      `UPDATE marketing_leads SET computed_stage = $1, decline_reason = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, reason, req.params.id]
    );
    res.json({ success: true, lead: rows[0] });
  } catch (err) {
    console.error('Patch lead status error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Current admission form document (singleton)
// `file_url` stores the Supabase Storage object path, not a URL — signed URLs expire,
// so a fresh one is generated here on every read.
router.get('/admission-form', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT f.file_url, f.file_name, f.uploaded_at, u.name AS uploaded_by_name
       FROM admission_form_document f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.id = 1`
    );
    if (!rows.length) return res.json(null);
    const signedUrl = await getSignedUrl(BUCKETS.admissionForms, rows[0].file_url);
    res.json({ ...rows[0], file_url: signedUrl });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/admission-form', requireRole(...MARKETING_ROLES), (req, res) => {
  uploadAdmissionForm(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed — only PDF/Word files up to 10MB are allowed.' });
    if (!req.file) return res.status(400).json({ error: 'Only PDF/Word files up to 10MB are allowed.' });
    try {
      const objectPath = `admission-form-${Date.now()}${path.extname(req.file.originalname)}`;
      await uploadFile(BUCKETS.admissionForms, objectPath, req.file.buffer, req.file.mimetype);
      const { rows } = await db.query(
        `INSERT INTO admission_form_document (id, file_url, file_name, uploaded_by, uploaded_at)
         VALUES (1, $1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET file_url = $1, file_name = $2, uploaded_by = $3, uploaded_at = NOW()
         RETURNING file_url, file_name, uploaded_at`,
        [objectPath, req.file.originalname, req.user.id]
      );
      const signedUrl = await getSignedUrl(BUCKETS.admissionForms, rows[0].file_url);
      res.json({ success: true, ...rows[0], file_url: signedUrl });
    } catch (err) {
      return sendServerError(res, err);
    }
  });
});

// Resend the Ed Admin application link — it's already sent automatically when
// the interview is marked passed; this is a manual fallback in case that
// message didn't land.
router.post('/leads/:id/send-form-link', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const scoped = await loadLeadForScope(req.params.id, req.scope);
    if (scoped === null) return res.status(404).json({ error: 'Lead not found.' });
    if (scoped === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const { rows } = await db.query(
      `SELECT id, parent_name, child_name, parent_phone, parent_email, whatsapp_number, computed_stage,
              EXISTS(SELECT 1 FROM admission_applications WHERE lead_id = marketing_leads.id) AS has_application,
              (SELECT outcome FROM interview_bookings WHERE lead_id = marketing_leads.id ORDER BY created_at DESC LIMIT 1) AS interview_outcome
       FROM marketing_leads WHERE id = $1`,
      [req.params.id]
    );
    const lead = rows[0];

    if (lead.has_application || STAGE_COMPLETE.includes(lead.computed_stage))
      return res.status(400).json({ error: 'This lead has already completed or does not need the admission form step.' });

    if (lead.interview_outcome !== 'passed')
      return res.status(400).json({ error: 'The lead must pass the interview before the admission form can be sent.' });

    await sendApplicationLink(lead);

    res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Manual fallback for the form_filled → enrolled step, for use until/alongside the
// Ed Admin webhook (POST /api/webhooks/edadmin/enrolment-confirmed) is connected.
// Guarded to only fire from 'form_filled' so it can't override a stage Ed Admin (or a
// payment) already advanced past this point.
router.patch('/leads/:id/mark-enrolled', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const lead = await loadLeadForScope(req.params.id, req.scope);
    if (lead === null) return res.status(404).json({ error: 'Lead not found.' });
    if (lead === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    if (lead.computed_stage !== 'form_filled')
      return res.status(400).json({ error: 'Only leads with a completed admission form can be marked as enrolled.' });

    await db.query(`UPDATE marketing_leads SET computed_stage = 'enrolled', updated_at = NOW() WHERE id = $1`, [lead.id]);
    await db.query(
      `UPDATE admission_applications SET enrolment_source = 'manual', enrolled_at = NOW(), enrolled_by = $1 WHERE lead_id = $2`,
      [req.user.id, lead.id]
    );

    const message = `Dear ${lead.parent_name}, congratulations! ${lead.child_name || 'Your child'} has been offered a place at Silverleaf Academy. Please complete the admission payment to secure the place, then send us your payment receipt so our admissions team can confirm it and finalize the enrolment.`;
    if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message, fallbackPhone: lead.parent_phone });
    else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message });
    if (lead.parent_email) {
      sendEmail({
        to: lead.parent_email,
        subject: 'Congratulations — Admission Offer from Silverleaf Academy',
        html: `<p>${escapeHtml(message)}</p>`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── TOURS ───────────────────────────────────────────────────
router.get('/tours', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT t.*, c.name AS campus_name, l.parent_name, l.child_name, l.parent_phone
       FROM tour_bookings t
       LEFT JOIN campuses c ON t.campus_id = c.id
       LEFT JOIN marketing_leads l ON t.lead_id = l.id
       ${scope.isGlobal ? '' : 'WHERE t.campus_id = $1'}
       ORDER BY t.tour_date DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/tours', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { lead_id, booked_by_name, booked_by_phone, booked_by_email, whatsapp_number, tour_date, tour_time, campus_id } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  try {
    if (lead_id) {
      const lead = await loadLeadForScope(lead_id, req.scope);
      if (lead === null) return res.status(404).json({ error: 'Lead not found.' });
      if (lead === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });
    }

    const { rows } = await db.query(
      `INSERT INTO tour_bookings (lead_id, campus_id, booked_by_name, booked_by_phone, booked_by_email, tour_date, tour_time, conducted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [lead_id || null, campusId, booked_by_name, booked_by_phone, booked_by_email, tour_date, tour_time, req.user.id]
    );

    // If lead exists, score update
    if (lead_id) {
      const { rows: scoreRows } = await db.query('SELECT compute_lead_score($1) AS score', [lead_id]);
      await db.query('UPDATE marketing_leads SET lead_score = $1, updated_at = NOW() WHERE id = $2', [scoreRows[0].score, lead_id]);
    }

    const tourMessage = `Dear ${booked_by_name}, your campus tour at Silverleaf Academy is confirmed for ${tour_date}${tour_time ? ` at ${tour_time}` : ''}. Please arrive 15 minutes early at reception, and bring a valid ID and your child's most recent school report (if applicable). We look forward to welcoming you!`;

    if (booked_by_email) {
      sendEmail({
        to: booked_by_email,
        subject: 'Tour Booking Confirmed — Silverleaf Academy',
        html: `<p>${escapeHtml(tourMessage)}</p>`,
      });
    }
    if (whatsapp_number) sendWhatsApp({ phone: whatsapp_number, message: tourMessage, fallbackPhone: booked_by_phone });
    else if (booked_by_phone) sendSMS({ phone: booked_by_phone, message: tourMessage });

    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/tours/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { status, rating, feedback } = req.body;
  try {
    const tour = await loadScopedRow(db, 'tour_bookings', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, tour);
    if (blocked) return blocked;

    const { rows } = await db.query(
      'UPDATE tour_bookings SET status=$1, rating=$2, feedback=$3 WHERE id=$4 RETURNING *',
      [status, rating, feedback, req.params.id]
    );
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── INTERVIEWS ────────────────────────────────────────────────
router.get('/interviews', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT i.*, c.name AS campus_name, l.parent_name, l.child_name, l.parent_phone
       FROM interview_bookings i
       LEFT JOIN campuses c ON i.campus_id = c.id
       LEFT JOIN marketing_leads l ON i.lead_id = l.id
       ${scope.isGlobal ? '' : 'WHERE i.campus_id = $1'}
       ORDER BY i.interview_date DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Book (or rebook, after a failed attempt) the admission interview — requires
// the campus tour to already be done, matching the funnel order.
router.post('/leads/:id/interviews', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { interview_date, interview_time, campus_id } = req.body;
  if (!interview_date) return res.status(400).json({ error: 'Interview date is required.' });

  try {
    const scoped = await loadLeadForScope(req.params.id, req.scope);
    if (scoped === null) return res.status(404).json({ error: 'Lead not found.' });
    if (scoped === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });

    const { rows } = await db.query(
      `SELECT id, campus_id, parent_name, child_name, parent_phone, parent_email, whatsapp_number,
              EXISTS(SELECT 1 FROM tour_bookings WHERE lead_id = marketing_leads.id) AS has_tour
       FROM marketing_leads WHERE id = $1`,
      [req.params.id]
    );
    const lead = rows[0];

    if (!lead.has_tour)
      return res.status(400).json({ error: 'Book a campus tour before scheduling the interview.' });

    // Global heads can choose which campus hosts the interview; campus heads
    // are locked to their own campus regardless of what the request sends.
    const campusId = req.scope.isGlobal ? (campus_id || lead.campus_id) : req.scope.campusId;

    const { rows: campusRows } = await db.query('SELECT name FROM campuses WHERE id = $1', [campusId]);
    const campusName = campusRows[0]?.name;

    const { rows: booking } = await db.query(
      `INSERT INTO interview_bookings (lead_id, campus_id, interview_date, interview_time, conducted_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [lead.id, campusId, interview_date, interview_time || null, req.user.id]
    );

    const message = `Dear ${lead.parent_name}, welcome to the Silverleaf Academy family! We're pleased to invite ${lead.child_name || 'your child'} for an admission interview at our ${campusName || 'Silverleaf Academy'} campus on ${interview_date}${interview_time ? ` at ${interview_time}` : ''}. Please arrive 15 minutes early. We look forward to meeting you!`;
    if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message, fallbackPhone: lead.parent_phone });
    else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message });
    if (lead.parent_email) {
      sendEmail({
        to: lead.parent_email,
        subject: 'Admission Interview Scheduled — Silverleaf Academy',
        html: `<p>${escapeHtml(message)}</p>`,
      });
    }

    res.json({ success: true, booking: booking[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Grade the interview pass/fail — parent is notified either way. Failing does
// not end the funnel; staff can call the booking route again to rebook.
router.patch('/interviews/:id/outcome', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { outcome, notes } = req.body;
  if (!['passed', 'failed'].includes(outcome))
    return res.status(400).json({ error: 'Outcome must be passed or failed.' });

  try {
    const bookingRow = await loadScopedRow(db, 'interview_bookings', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, bookingRow);
    if (blocked) return blocked;

    const { rows } = await db.query(
      `UPDATE interview_bookings SET outcome = $1, status = 'completed', notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [outcome, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Interview not found.' });
    const booking = rows[0];

    const { rows: leadRows } = await db.query(
      'SELECT id, parent_name, child_name, parent_phone, parent_email, whatsapp_number FROM marketing_leads WHERE id = $1',
      [booking.lead_id]
    );
    const lead = leadRows[0];
    if (lead && outcome === 'passed') {
      await sendApplicationLink(lead);
    } else if (lead) {
      const message = `Dear ${lead.parent_name}, thank you for attending the admission interview for ${lead.child_name || 'your child'} at Silverleaf Academy. They did not pass this time — our admissions team will be in touch to discuss next steps.`;
      if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message, fallbackPhone: lead.parent_phone });
      else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message });
      if (lead.parent_email) {
        sendEmail({
          to: lead.parent_email,
          subject: 'Interview Result — Silverleaf Academy',
          html: `<p>${escapeHtml(message)}</p>`,
        });
      }
    }

    res.json({ success: true, booking });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── ADMISSION PAYMENTS ───────────────────────────────────────
router.post('/payments', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { lead_id, campus_id, amount, currency, payment_method, reference_number, paid_at, notes } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0)
    return res.status(400).json({ error: 'amount must be a positive number.' });

  try {
    const leadRow = await loadLeadForScope(lead_id, req.scope);
    if (leadRow === null) return res.status(404).json({ error: 'Lead not found.' });
    if (leadRow === false) return res.status(403).json({ error: 'Lead is outside your campus scope.' });
    if (leadRow.computed_stage !== 'enrolled')
      return res.status(400).json({ error: 'This lead must be enrolled before payment can be recorded.' });

    const { rows } = await db.query(
      `INSERT INTO admission_payments
         (lead_id, campus_id, amount, currency, payment_method, reference_number, paid_at, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [lead_id, campusId, numericAmount, currency || 'TZS', payment_method, reference_number, paid_at || new Date(), req.user.id, notes]
    );

    // Update score
    const { rows: s } = await db.query('SELECT compute_lead_score($1) AS score', [lead_id]);
    await db.query('UPDATE marketing_leads SET lead_score = $1 WHERE id = $2', [s[0].score, lead_id]);

    // Update campaign conversions + fetch contact details for the receipt
    const lead = (await db.query(
      'SELECT campaign_id, parent_email, parent_name, parent_phone, whatsapp_number, child_name FROM marketing_leads WHERE id = $1',
      [lead_id]
    )).rows[0];
    if (lead?.campaign_id) {
      await db.query('UPDATE marketing_campaigns SET conversions = conversions + 1 WHERE id = $1', [lead.campaign_id]);
    }

    // Payment confirmation / receipt to parent
    const receiptMsg = `Dear ${lead.parent_name}, we've received your admission payment of ${currency || 'TZS'} ${amount} for ${lead.child_name || 'your child'}${reference_number ? ` (ref: ${reference_number})` : ''}. Welcome to the Silverleaf Academy family! Our admissions team will be in touch with onboarding details.`;
    if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message: receiptMsg, fallbackPhone: lead.parent_phone });
    else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message: receiptMsg });
    if (lead.parent_email) {
      sendEmail({
        to: lead.parent_email,
        subject: 'Payment Received — Welcome to Silverleaf Academy',
        html: `<p>${escapeHtml(receiptMsg)}</p>`,
      });
    }

    // Notify marketing team + Ed Admin handoff point
    broadcast(req.scope.isGlobal ? 'global' : `campus-${campusId}`, 'admission_paid', { leadId: lead_id, amount, campusId });

    res.json({ success: true, payment: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── CAMPAIGNS ────────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  const { scope } = req;
  const campus = scopedCampus(scope, req.query);
  try {
    const { rows } = await db.query(
      `SELECT mc.*, c.name AS campus_name,
              ROUND(CASE WHEN mc.leads_generated > 0
                    THEN mc.spent / mc.leads_generated ELSE 0 END, 2) AS cost_per_lead,
              ROUND(CASE WHEN mc.conversions > 0
                    THEN mc.spent / mc.conversions ELSE 0 END, 2) AS cost_per_conversion
       FROM marketing_campaigns mc LEFT JOIN campuses c ON mc.campus_id = c.id
       ${campus.id ? 'WHERE mc.campus_id = $1 OR mc.campus_id IS NULL' : ''}
       ORDER BY mc.created_at DESC`,
      campus.params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/campaigns', requireRole(...MARKETING_ROLES), async (req, res) => {
  const {
    campus_id, name, type, description, start_date, end_date, budget,
    station_name, air_times, location_desc, platform, ad_account_id,
    slug, utm_source, utm_medium, utm_campaign,
  } = req.body;
  const campusId = req.scope.isGlobal ? (campus_id || null) : req.scope.campusId;
  const campaignSlug = slugify(slug || name);

  try {
    const { rows } = await db.query(
      `INSERT INTO marketing_campaigns
         (campus_id, name, type, description, start_date, end_date, budget,
          station_name, air_times, location_desc, platform, ad_account_id, created_by,
          slug, utm_source, utm_medium, utm_campaign)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [campusId, name, type, description, start_date, end_date, budget || 0,
       station_name, air_times, location_desc, platform, ad_account_id, req.user.id,
       campaignSlug || null, utm_source || type || 'campaign', utm_medium || 'organic',
       utm_campaign || campaignSlug || null]
    );
    res.json({ success: true, campaign: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/campaigns/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const {
    name, status, spent, budget, description, end_date,
    type, campus_id, start_date, station_name, air_times, location_desc, platform,
    slug, utm_source, utm_medium, utm_campaign,
  } = req.body;
  try {
    const campaign = await loadScopedRow(db, 'marketing_campaigns', req.params.id, req.scope);
    // Global campaigns (null campus) are editable by global heads only
    if (campaign === null) return res.status(404).json({ error: 'Not found.' });
    if (campaign === false) return res.status(403).json({ error: 'Outside your campus scope.' });
    if (!req.scope.isGlobal && campaign.campus_id == null)
      return res.status(403).json({ error: 'Campus staff cannot edit global campaigns.' });

    const nextCampusId = campus_id === undefined
      ? campaign.campus_id
      : (req.scope.isGlobal ? (campus_id || null) : req.scope.campusId);

    const { rows } = await db.query(
      `UPDATE marketing_campaigns SET
         name          = COALESCE($1, name),
         status        = COALESCE($2, status),
         spent         = COALESCE($3, spent),
         budget        = COALESCE($4, budget),
         description   = COALESCE($5, description),
         end_date      = COALESCE($6, end_date),
         type          = COALESCE($7, type),
         campus_id     = $8,
         start_date    = COALESCE($9, start_date),
         station_name  = COALESCE($10, station_name),
         air_times     = COALESCE($11, air_times),
         location_desc = COALESCE($12, location_desc),
         platform      = COALESCE($13, platform),
         slug          = COALESCE($14, slug),
         utm_source    = COALESCE($15, utm_source),
         utm_medium    = COALESCE($16, utm_medium),
         utm_campaign  = COALESCE($17, utm_campaign),
         updated_at    = NOW()
       WHERE id = $18 RETURNING *`,
      [name, status, spent, budget, description, end_date,
       type, nextCampusId, start_date, station_name, air_times, location_desc, platform,
       slug ? slugify(slug) : null, utm_source, utm_medium, utm_campaign,
       req.params.id]
    );
    res.json({ success: true, campaign: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── SOCIAL ANALYTICS ─────────────────────────────────────────
router.get('/social', async (req, res) => {
  const { scope } = req;
  const { period = 'monthly', platform } = req.query;
  const campus = scopedCampus(scope, req.query);
  let from = new Date();
  if (period === 'weekly')  from.setDate(from.getDate() - 7);
  if (period === 'monthly') from.setMonth(from.getMonth() - 1);
  if (period === 'yearly')  from.setFullYear(from.getFullYear() - 1);
  const fromStr = from.toISOString().slice(0, 10);

  let params = [fromStr];
  let conds  = ['date >= $1'];
  if (campus.id) { params.push(campus.id); conds.push(`campus_id = $${params.length}`); }
  if (platform)        { params.push(platform);        conds.push(`platform = $${params.length}`); }

  try {
    const { rows } = await db.query(
      `SELECT platform, date, followers, reach, impressions, engagement_rate, posts_count, leads_from_platform
       FROM social_analytics WHERE ${conds.join(' AND ')} ORDER BY date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/social', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { campus_id, platform, date, followers, reach, impressions, engagement_rate, posts_count, leads_from_platform } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  try {
    const { rows } = await db.query(
      `INSERT INTO social_analytics (campus_id, platform, date, followers, reach, impressions, engagement_rate, posts_count, leads_from_platform, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual')
       ON CONFLICT (campus_id, platform, date) DO UPDATE SET
         followers=$4, reach=$5, impressions=$6, engagement_rate=$7,
         posts_count=$8, leads_from_platform=$9, source='manual'
       RETURNING *`,
      [campusId, platform, date, followers, reach, impressions, engagement_rate, posts_count, leads_from_platform]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/social/buffer/sync', requireRole(...MARKETING_ROLES), async (_req, res) => {
  try {
    const result = await buffer.syncAnalytics(db);
    if (result.skipped) {
      return res.status(503).json({
        error: result.reason,
        configured: false,
      });
    }
    broadcast('global', 'social-updated', { source: 'buffer' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Buffer sync error:', err.message);
    res.status(502).json({ error: err.message || 'Buffer sync failed.' });
  }
});

// ── SCHOOL EVENTS ─────────────────────────────────────────────
router.get('/events', async (req, res) => {
  const { scope } = req;
  const campus = scopedCampus(scope, req.query);
  try {
    const params = [['open_day', 'enrolment_window', 'term_start', 'term_end']];
    const campusSql = campus.id ? 'AND (campus_id = $2 OR campus_id IS NULL)' : '';
    if (campus.id) params.push(campus.id);
    const { rows } = await db.query(
      `SELECT * FROM school_events
       WHERE audience IN ('marketing','all')
         AND event_type = ANY($1)
         ${campusSql}
       ORDER BY start_date`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/events', requireRole(...MARKETING_ROLES), async (req, res) => {
  const {
    campus_id, title, description, event_type, start_date, end_date, start_time,
    location, is_public, audience,
  } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  try {
    const { rows } = await db.query(
      `INSERT INTO school_events
         (campus_id, title, description, event_type, start_date, end_date, start_time,
          location, created_by, is_public, audience, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual') RETURNING *`,
      [
        campusId || null, title, description, event_type, start_date, end_date || null,
        start_time || null, location, req.user.id, Boolean(is_public),
        audience || (is_public ? 'marketing' : 'internal'),
      ]
    );
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/events/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { title, description, event_type, start_date, end_date, location, is_public, audience } = req.body;
  try {
    const event = await loadScopedRow(db, 'school_events', req.params.id, req.scope);
    if (event === null) return res.status(404).json({ error: 'Not found.' });
    if (event === false) return res.status(403).json({ error: 'Outside your campus scope.' });
    if (!req.scope.isGlobal && event.campus_id == null)
      return res.status(403).json({ error: 'Campus staff cannot edit global events.' });

    const { rows } = await db.query(
      `UPDATE school_events SET title=$1, description=$2, event_type=$3,
         start_date=$4, end_date=$5, location=$6,
         is_public = COALESCE($7, is_public),
         audience = COALESCE($8, audience),
         updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [
        title, description, event_type, start_date, end_date, location,
        is_public === undefined ? null : Boolean(is_public),
        audience || null,
        req.params.id,
      ]
    );
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Lookback + bucket. Cap created_at at NOW() so future import dates do not smear trends.
const ANALYTICS_PERIODS = {
  daily:   { interval: '14 days',   trunc: 'day' },
  weekly:  { interval: '12 weeks',  trunc: 'week' },
  monthly: { interval: '12 months', trunc: 'month' },
  yearly:  { interval: '5 years',   trunc: 'year' },
};

// ── ANALYTICS (period-based) ─────────────────────────────────
router.get('/analytics', async (req, res) => {
  const { scope } = req;
  const { period = 'monthly' } = req.query;
  const campus = scopedCampus(scope, req.query);
  const spec = ANALYTICS_PERIODS[period] || ANALYTICS_PERIODS.monthly;
  const trunc = spec.trunc;
  const p = [...campus.params, spec.interval];
  const intervalRef = `$${p.length}`;
  const cw = campus.where('l.campus_id');
  const createdWindow = `${cw ? `${cw} AND` : 'WHERE'} l.created_at >= NOW() - ${intervalRef}::interval
           AND l.created_at <= NOW()
           AND l.is_archived = FALSE`;

  try {
    const [trend, conversionRates, topSources] = await Promise.all([
      db.query(
        `SELECT DATE_TRUNC('${trunc}', l.created_at) AS period,
                COUNT(*)::int AS leads,
                COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid
         FROM marketing_leads l
         ${createdWindow}
         GROUP BY 1 ORDER BY 1`,
        p
      ),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE computed_stage NOT IN ('declined','lapsed'))::int AS total_leads,
           COUNT(*) FILTER (WHERE computed_stage = 'interested_lead')::int AS interested,
           COUNT(*) FILTER (WHERE computed_stage = 'tour_booked')::int      AS tour_rate,
           COUNT(*) FILTER (WHERE computed_stage = 'interview_booked')::int AS interview_rate,
           COUNT(*) FILTER (WHERE computed_stage = 'form_filled')::int      AS form_rate,
           COUNT(*) FILTER (WHERE computed_stage = 'enrolled')::int         AS enrolled_rate,
           COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int   AS paid_rate,
           COUNT(*) FILTER (WHERE computed_stage = 'dead_lead')::int        AS dead_leads
         FROM marketing_leads l
         ${cw ? `${cw} AND` : 'WHERE'} l.is_archived = FALSE`,
        campus.params
      ),
      db.query(
        `SELECT COALESCE(NULLIF(source::text, ''), 'other') AS source, COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS conversions
         FROM marketing_leads l
         ${createdWindow}
         GROUP BY 1 ORDER BY count DESC`,
        p
      ),
    ]);

    res.json({
      period,
      trend: trend.rows,
      conversion: conversionRates.rows[0],
      sources: topSources.rows,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── WAITLIST ──────────────────────────────────────────────────
router.get('/waitlist', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT w.*, l.parent_name, l.child_name, l.parent_phone, c.name AS campus_name
       FROM waitlist w JOIN marketing_leads l ON w.lead_id = l.id JOIN campuses c ON w.campus_id = c.id
       ${scope.isGlobal ? '' : 'WHERE w.campus_id = $1'} ORDER BY w.created_at`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/waitlist', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { lead_id, campus_id, class_name } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;
  try {
    const pos = (await db.query('SELECT COUNT(*)+1 AS pos FROM waitlist WHERE campus_id=$1 AND class_name=$2', [campusId, class_name])).rows[0].pos;
    const { rows } = await db.query(
      'INSERT INTO waitlist (lead_id, campus_id, class_name, position) VALUES ($1,$2,$3,$4) RETURNING *',
      [lead_id, campusId, class_name, pos]
    );
    res.json({ success: true, entry: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── FOLLOW-UP TASKS ───────────────────────────────────────────
router.get('/tasks', requireRole(...MARKETING_ROLES), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ft.*, l.parent_name, l.child_name, l.computed_stage
       FROM follow_up_tasks ft JOIN marketing_leads l ON ft.lead_id = l.id
       WHERE ft.assigned_to = $1 AND ft.status = 'pending'
       ORDER BY ft.due_date`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/tasks/:id', requireRole(...MARKETING_ROLES), async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE follow_up_tasks SET status=$1 WHERE id=$2 AND assigned_to=$3 RETURNING *',
      [status, req.params.id, req.user.id]
    );
    res.json({ success: true, task: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
