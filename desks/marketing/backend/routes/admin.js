const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateSession, requireRole, requirePasswordChanged, validateSilverleafEmail, sanitizeAdditionalRoles, DEFAULT_PASSWORD, MANAGED_ROLES, BCRYPT_COST, isProtectedAccount, TEAM_ADMIN_ROLES } = require('../middleware/auth');
const { computeLeadVitality, isFollowUpOverdue } = require('../lib/leadVitality');
const { sendServerError, escapeHtml, loadScopedRow, forbiddenOrNotFound, assertCampusAccess } = require('../lib/safe');

router.use(authenticateSession);
router.use(requirePasswordChanged);

const GLOBAL_HEADS = ['ceo', 'global_marketing_head', 'global_student_exp_head'];

// ── CAMPUSES ────────────────────────────────────────────────
router.get('/campuses', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM campuses ORDER BY name');
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/campuses', requireRole(...GLOBAL_HEADS), async (req, res) => {
  const { name, code, location } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code are required.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO campuses (name, code, location) VALUES ($1, $2, $3) RETURNING *',
      [name, code.toUpperCase(), location]
    );
    res.json({ success: true, campus: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Campus code already exists.' });
    return sendServerError(res, err);
  }
});

router.patch('/campuses/:id', requireRole(...GLOBAL_HEADS), async (req, res) => {
  const { name, location, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE campuses SET
         name      = COALESCE($1, name),
         location  = COALESCE($2, location),
         is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [name, location, is_active, req.params.id]
    );
    res.json({ success: true, campus: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── USERS ───────────────────────────────────────────────────
router.get('/users', requireRole(...GLOBAL_HEADS), async (req, res) => {
  try {
    const { scope } = req;
    const allowedRoles = MANAGED_ROLES[req.user.role];
    const conditions = [];
    const params = [];

    if (!scope.isGlobal) {
      params.push(scope.campusId);
      conditions.push(`u.campus_id = $${params.length}`);
    }
    if (allowedRoles) {
      params.push(allowedRoles);
      conditions.push(`u.role = ANY($${params.length})`);
    }

    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.campus_id, u.department,
              u.is_active, u.last_login, u.must_change_password, u.created_at,
              c.name AS campus_name
       FROM users u LEFT JOIN campuses c ON u.campus_id = c.id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY u.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/users', requireRole(...GLOBAL_HEADS), async (req, res) => {
  const { name, email, role, campus_id, department, phone, additional_roles, password, must_change_password } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!validateSilverleafEmail(email))
    return res.status(400).json({ error: 'Email must be a @silverleaf.co.tz address.' });
  if (isProtectedAccount(email))
    return res.status(403).json({ error: 'That account is reserved and cannot be created here.' });

  const allowedRoles = MANAGED_ROLES[req.user.role];
  if (allowedRoles && !allowedRoles.includes(role))
    return res.status(403).json({ error: 'You can only create staff within your own department.' });

  const custom = typeof password === 'string' ? password.trim() : '';
  if (custom && custom.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const nextPassword = custom || DEFAULT_PASSWORD;
  const mustChange = must_change_password !== false && must_change_password !== 'false';

  try {
    const hash = await bcrypt.hash(nextPassword, BCRYPT_COST);
    const additionalRolesArr = sanitizeAdditionalRoles(req.user.role, role, additional_roles);

    const { rows } = await db.query(
      `INSERT INTO users
         (name, email, password_hash, role, additional_roles, campus_id, department, phone, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, email, role, campus_id, department, must_change_password, is_active`,
      [name.trim(), email.toLowerCase(), hash, role, additionalRolesArr, campus_id || null, department, phone, mustChange]
    );
    res.json({
      success: true,
      user: rows[0],
      password_set: !!custom,
      must_change_password: mustChange,
      message: custom
        ? (mustChange
          ? 'User created. They must change this password the first time they sign in.'
          : 'User created. They can change the password from Profile after signing in.')
        : 'User created. Share the configured temporary password with them out of band.',
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered.' });
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/users/:id', requireRole(...GLOBAL_HEADS), async (req, res) => {
  const { name, role, campus_id, department, phone, is_active, additional_roles, must_change_password } = req.body;
  try {
    const { rows: targetRows } = await db.query('SELECT id, role, email FROM users WHERE id = $1', [req.params.id]);
    if (!targetRows.length) return res.status(404).json({ error: 'User not found.' });
    const target = targetRows[0];

    const allowedRoles = MANAGED_ROLES[req.user.role];
    if (allowedRoles) {
      if (!allowedRoles.includes(target.role))
        return res.status(403).json({ error: 'You can only manage staff within your own department.' });
      if (role && !allowedRoles.includes(role))
        return res.status(403).json({ error: 'You can only assign roles within your own department.' });
    }

    if (is_active === false) {
      if (!TEAM_ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({ error: 'Only marketing@silverleaf.co.tz and the CEO can deactivate accounts.' });
      }
      if (isProtectedAccount(target.email)) {
        return res.status(403).json({ error: 'The marketing and CEO accounts cannot be deactivated.' });
      }
      if (String(target.id) === String(req.user.id)) {
        return res.status(403).json({ error: 'You cannot deactivate your own account.' });
      }
    }

    const primaryForExtras = role || undefined;
    let additionalRolesArr;
    if (Array.isArray(additional_roles)) {
      const effectivePrimary = primaryForExtras || target.role;
      additionalRolesArr = sanitizeAdditionalRoles(req.user.role, effectivePrimary, additional_roles);
    }

    const { rows } = await db.query(
      `UPDATE users SET
         name                 = COALESCE($1, name),
         role                 = COALESCE($2, role),
         campus_id            = COALESCE($3, campus_id),
         department           = COALESCE($4, department),
         phone                = COALESCE($5, phone),
         is_active            = COALESCE($6, is_active),
         additional_roles     = COALESCE($7, additional_roles),
         must_change_password = COALESCE($8, must_change_password),
         updated_at           = NOW()
       WHERE id = $9
       RETURNING id, name, email, role, campus_id, department, is_active, must_change_password`,
      [name, role, campus_id || null, department, phone, is_active, additionalRolesArr, must_change_password, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/overview', requireRole(...TEAM_ADMIN_ROLES), async (req, res) => {
  try {
    const smoke = `l.is_archived = FALSE
      AND l.parent_name NOT ILIKE 'Smoke %'
      AND l.parent_name NOT ILIKE 'Live Parent %'
      AND COALESCE(l.child_name, '') NOT ILIKE 'Smoke %'`;

        let snapshot = {};
    try {
      snapshot = require('../data/marketing-master-dashboard-2026.json');
    } catch {
      snapshot = {};
    }
    const sheetCluster = snapshot.cluster || {};
    const sheetCampuses = snapshot.campus_funnel || {};
    const occupancy = snapshot.campus_occupancy || {};

    const [totals, campusRows, leadRows, teamRows, trendRows, sourceRows, campaignTotals] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE computed_stage NOT IN ('declined','lapsed'))::int AS active,
           COUNT(*) FILTER (WHERE computed_stage = 'admission_paid')::int AS paid,
           COUNT(*) FILTER (WHERE computed_stage = 'dead_lead')::int AS dead,
           COUNT(*) FILTER (WHERE computed_stage IN ('declined','lapsed'))::int AS declined,
           COUNT(*) FILTER (WHERE computed_stage = 'interested_lead')::int AS interested,
           COUNT(*) FILTER (WHERE computed_stage = 'tour_booked')::int AS tour_booked,
           COUNT(*) FILTER (WHERE computed_stage = 'interview_booked')::int AS interview_booked,
           COUNT(*) FILTER (WHERE computed_stage IN ('form_filled','registered'))::int AS registered,
           COUNT(*) FILTER (WHERE computed_stage = 'enrolled')::int AS enrolled,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_this_week,
           COUNT(*) FILTER (WHERE computed_stage = 'admission_paid' AND updated_at >= NOW() - INTERVAL '7 days')::int AS paid_this_week
         FROM marketing_leads l
         WHERE ${smoke}`
      ),
      db.query(
        `SELECT c.id, c.name, c.code,
                COUNT(l.id) FILTER (WHERE ${smoke})::int AS leads,
                COUNT(l.id) FILTER (WHERE ${smoke} AND l.computed_stage = 'admission_paid')::int AS paid,
                COUNT(l.id) FILTER (WHERE ${smoke} AND l.computed_stage = 'interested_lead')::int AS interested,
                COUNT(l.id) FILTER (WHERE ${smoke} AND l.computed_stage = 'dead_lead')::int AS dead,
                COUNT(l.id) FILTER (WHERE ${smoke} AND l.computed_stage NOT IN ('declined','lapsed','dead_lead','admission_paid','enrolled'))::int AS open_pipeline
         FROM campuses c
         LEFT JOIN marketing_leads l ON l.campus_id = c.id
         WHERE c.is_active = TRUE
         GROUP BY c.id
         ORDER BY c.name`
      ),
      db.query(
        `SELECT l.computed_stage, l.last_contacted_at, l.created_at, l.updated_at, l.follow_up_date,
                l.sibling_flag, l.source, l.intended_term, l.parent_phone, l.parent_email,
                l.whatsapp_number, l.lead_score,
                EXISTS(SELECT 1 FROM tour_bookings t WHERE t.lead_id = l.id) AS has_tour,
                EXISTS(SELECT 1 FROM admission_applications a WHERE a.lead_id = l.id) AS has_application,
                EXISTS(SELECT 1 FROM admission_payments p WHERE p.lead_id = l.id) AS has_payment,
                EXISTS(SELECT 1 FROM interview_bookings ib WHERE ib.lead_id = l.id) AS has_interview,
                (SELECT ib.outcome FROM interview_bookings ib WHERE ib.lead_id = l.id ORDER BY ib.created_at DESC LIMIT 1) AS interview_outcome
         FROM marketing_leads l
         WHERE ${smoke}`
      ),
      db.query(
        `SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_login, u.must_change_password,
                c.name AS campus_name
         FROM users u
         LEFT JOIN campuses c ON c.id = u.campus_id
         WHERE u.role = 'campus_marketing_head' OR LOWER(u.email) IN ('marketing@silverleaf.co.tz','ceo@silverleaf.co.tz')
         ORDER BY u.role DESC, u.name`
      ),
      db.query(
        `SELECT DATE_TRUNC('week', l.created_at)::date AS week,
                COUNT(*)::int AS leads,
                COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid
         FROM marketing_leads l
         WHERE ${smoke} AND l.created_at >= NOW() - INTERVAL '12 weeks'
         GROUP BY 1
         ORDER BY 1`
      ),
      db.query(
        `SELECT COALESCE(l.source::text, 'unknown') AS source,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE l.computed_stage = 'admission_paid')::int AS paid
         FROM marketing_leads l
         WHERE ${smoke}
         GROUP BY 1
         ORDER BY count DESC`
      ),
      db.query(
        `SELECT COALESCE(SUM(budget), 0)::float AS budget,
                COALESCE(SUM(spent), 0)::float AS spent,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM marketing_campaigns`
      ),
    ]);

    const vitality = { hot: 0, warm: 0, cold: 0, dead: 0 };
    let overdue = 0;
    for (const row of leadRows.rows) {
      const stage = row.computed_stage || '';
      if (!['declined', 'lapsed', 'admission_paid', 'enrolled'].includes(stage)) {
        const status = computeLeadVitality(row).status;
        if (vitality[status] != null) vitality[status] += 1;
      }
      if (isFollowUpOverdue(row)) overdue += 1;
    }

    const paid = totals.rows[0]?.paid || 0;
    const active = totals.rows[0]?.active || 0;
    const target = sheetCluster.target_enrollment_2026 || 0;
    const progressPct = target ? Math.round((paid / target) * 1000) / 10 : 0;
    const sheetPaid = sheetCluster.enrolled_admission_paid || 0;
    const conversionVsSheet = Math.round(((sheetCluster.conversion_rate || 0) * 1000)) / 10;

    const campuses = campusRows.rows.map((c) => {
      const sheet = sheetCampuses[c.code] || {};
      const occ = occupancy[c.code] || null;
      const campusTarget = sheet.target_enrollment || occ?.capacity || 0;
      const campusProgress = campusTarget ? Math.round((c.paid / campusTarget) * 1000) / 10 : 0;
      return {
        ...c,
        target: campusTarget,
        progress_pct: campusProgress,
        sheet_paid: sheet.enrolled_admission_paid || 0,
        on_target: campusTarget ? c.paid >= (sheet.enrolled_admission_paid || 0) : true,
        occupancy_pct: occ && occ.pct != null ? Math.round(occ.pct * 1000) / 10 : null,
        occupancy_enrolled: occ?.enrolled ?? null,
        occupancy_capacity: occ?.capacity ?? null,
      };
    });

    const funnel = [
      { key: 'interested_lead', label: 'Interested', value: totals.rows[0]?.interested || 0 },
      { key: 'tour_booked', label: 'Tour booked', value: totals.rows[0]?.tour_booked || 0 },
      { key: 'interview_booked', label: 'Interview', value: totals.rows[0]?.interview_booked || 0 },
      { key: 'registered', label: 'Registered', value: totals.rows[0]?.registered || 0 },
      { key: 'enrolled', label: 'Enrolled', value: totals.rows[0]?.enrolled || 0 },
      { key: 'admission_paid', label: 'Admission paid', value: paid },
    ];

    const trend = trendRows.rows.map((r) => ({
      week: r.week ? new Date(r.week).toISOString().slice(0, 10) : null,
      leads: r.leads || 0,
      paid: r.paid || 0,
    }));

    const sources = sourceRows.rows.map((r) => ({
      source: String(r.source || 'unknown').replace(/_/g, ' '),
      count: r.count || 0,
      paid: r.paid || 0,
      conversion: r.count ? Math.round((r.paid / r.count) * 1000) / 10 : 0,
    }));

    const campaign = campaignTotals.rows[0] || { budget: 0, spent: 0, active: 0 };
    const spendPct = campaign.budget ? Math.round((campaign.spent / campaign.budget) * 1000) / 10 : 0;

    let studentExperience = null;
    let dispensary = null;
    try {
      const [incidents, walkthroughs] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status IS NULL OR status NOT IN ('resolved','closed'))::int AS open
           FROM student_incidents`
        ),
        db.query(
          `SELECT COUNT(*)::int AS total
           FROM safety_walkthroughs
           WHERE walkthrough_date >= date_trunc('month', CURRENT_DATE)`
        ),
      ]);
      studentExperience = {
        incidents_total: incidents.rows[0]?.total || 0,
        incidents_open: incidents.rows[0]?.open || 0,
        walkthroughs_this_month: walkthroughs.rows[0]?.total || 0,
      };
    } catch {
      studentExperience = null;
    }
    try {
      const visits = await db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_emergency = TRUE)::int AS emergencies
         FROM dispensary_visits
         WHERE visit_date >= date_trunc('month', CURRENT_DATE)`
      );
      dispensary = {
        visits_this_month: visits.rows[0]?.total || 0,
        emergencies_this_month: visits.rows[0]?.emergencies || 0,
      };
    } catch {
      dispensary = null;
    }

    const members = teamRows.rows;
    const neverLoggedIn = members.filter((u) => u.is_active && !u.last_login).length;
    const attention = [];
    if (overdue > 0) {
      attention.push({
        tone: 'danger',
        label: `${overdue} lead${overdue === 1 ? '' : 's'} overdue for follow-up`,
        href: '/marketing/leads',
      });
    }
    if ((vitality.cold || 0) > 0) {
      attention.push({
        tone: 'warning',
        label: `${vitality.cold} lead${vitality.cold === 1 ? '' : 's'} at risk of going cold`,
        href: '/marketing/leads',
      });
    }
    if (studentExperience?.incidents_open > 0) {
      attention.push({
        tone: 'warning',
        label: `${studentExperience.incidents_open} open student-experience incident${studentExperience.incidents_open === 1 ? '' : 's'}`,
        href: '/se/incidents',
      });
    }
    if (dispensary?.emergencies_this_month > 0) {
      attention.push({
        tone: 'danger',
        label: `${dispensary.emergencies_this_month} dispensary emergenc${dispensary.emergencies_this_month === 1 ? 'y' : 'ies'} this month`,
        href: '/dispensary',
      });
    }
    if (neverLoggedIn > 0) {
      attention.push({
        tone: 'info',
        label: `${neverLoggedIn} marketing account${neverLoggedIn === 1 ? '' : 's'} have never signed in`,
        href: '/marketing/team',
      });
    }

    res.json({
      generated_at: new Date().toISOString(),
      marketing: {
        totals: { ...totals.rows[0], overdue },
        vitality,
        conversion_rate: active ? Math.round((paid / active) * 1000) / 10 : 0,
        conversion_sheet: conversionVsSheet,
        campuses,
        funnel,
        trend,
        sources,
        campaign: {
          budget: campaign.budget || 0,
          spent: campaign.spent || 0,
          active: campaign.active || 0,
          spend_pct: spendPct,
        },
        enrollment: {
          target_2026: target,
          paid,
          sheet_paid: sheetPaid,
          progress_pct: progressPct,
          on_target: paid >= sheetPaid,
          remaining: Math.max(0, target - paid),
        },
      },
      team: {
        members,
        active: members.filter((u) => u.is_active).length,
        inactive: members.filter((u) => !u.is_active).length,
        never_logged_in: neverLoggedIn,
      },
      student_experience: studentExperience,
      dispensary,
      attention,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── REPORTS ENGINE ──────────────────────────────────────────
router.get('/reports', requireRole(...GLOBAL_HEADS), async (req, res) => {
  const { module, period = 'monthly', campus_id, from, to, format = 'json' } = req.query;
  const { scope } = req;

  const campusFilter = scope.isGlobal
    ? (campus_id ? parseInt(campus_id) : null)
    : scope.campusId;

  const dateFilter = from && to
    ? { from, to }
    : getPeriodDates(period);

  try {
    let data = {};

    if (module === 'marketing') {
      data = await getMarketingReport(campusFilter, dateFilter);
    } else if (module === 'se') {
      data = await getSEReport(campusFilter, dateFilter);
    } else if (module === 'dispensary') {
      data = await getDispensaryReport(campusFilter, dateFilter);
    } else {
      // All modules
      const [mkt, se, disp] = await Promise.all([
        getMarketingReport(campusFilter, dateFilter),
        getSEReport(campusFilter, dateFilter),
        getDispensaryReport(campusFilter, dateFilter),
      ]);
      data = { marketing: mkt, se, dispensary: disp };
    }

    if (format === 'json') {
      res.json({ period, dateFilter, campus_id: campusFilter, data });
    } else {
      // Trigger PDF/Excel generation (handled client-side for now)
      res.json({ period, dateFilter, campus_id: campusFilter, data, format });
    }
  } catch (err) {
    return sendServerError(res, err);
  }
});

function getPeriodDates(period) {
  const now = new Date();
  let from, to = now.toISOString().slice(0, 10);
  switch (period) {
    case 'daily':   from = to; break;
    case 'weekly':  from = new Date(now - 7  * 86400000).toISOString().slice(0, 10); break;
    case 'monthly': from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); break;
    case 'yearly':  from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); break;
    default:        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  return { from, to };
}

async function getMarketingReport(campusId, { from, to }) {
  const p = campusId ? [campusId, from, to] : [from, to];
  const cw = campusId ? 'AND campus_id = $1' : '';
  const off = campusId ? 1 : 0;

  const [funnel, sources, campaigns] = await Promise.all([
    db.query(
      `SELECT computed_stage, COUNT(*) FROM marketing_leads
       WHERE created_at BETWEEN $${off+1} AND $${off+2} ${cw} GROUP BY computed_stage`,
      p
    ),
    db.query(
      `SELECT source, COUNT(*) FROM marketing_leads
       WHERE created_at BETWEEN $${off+1} AND $${off+2} ${cw} GROUP BY source`,
      p
    ),
    db.query(
      `SELECT name, type, budget, spent, leads_generated, conversions
       FROM marketing_campaigns WHERE status != 'draft' ${campusId ? 'AND (campus_id = $1 OR campus_id IS NULL)' : ''}`,
      campusId ? [campusId] : []
    ),
  ]);
  return { funnel: funnel.rows, sources: sources.rows, campaigns: campaigns.rows };
}

async function getSEReport(campusId, { from, to }) {
  const p = campusId ? [campusId, from, to] : [from, to];
  const cw = campusId ? 'AND campus_id = $1' : '';
  const off = campusId ? 1 : 0;

  const [incidents, walkthroughs, behaviours] = await Promise.all([
    db.query(
      `SELECT severity, incident_location, status, COUNT(*) FROM student_incidents
       WHERE created_at BETWEEN $${off+1} AND $${off+2} ${cw} GROUP BY severity, incident_location, status`,
      p
    ),
    db.query(
      `SELECT swf.risk_level, swf.area, swf.status, COUNT(*) FROM walkthrough_area_findings swf
       JOIN safety_walkthroughs sw ON sw.id = swf.walkthrough_id
       WHERE sw.walkthrough_date BETWEEN $${off+1} AND $${off+2} ${campusId ? 'AND sw.campus_id = $1' : ''}
       GROUP BY swf.risk_level, swf.area, swf.status`,
      p
    ),
    db.query(
      `SELECT intervention, frequency, COUNT(*) FROM behavioural_walkthroughs
       WHERE created_at BETWEEN $${off+1} AND $${off+2} ${cw} GROUP BY intervention, frequency`,
      p
    ),
  ]);
  return { incidents: incidents.rows, walkthroughs: walkthroughs.rows, behaviours: behaviours.rows };
}

async function getDispensaryReport(campusId, { from, to }) {
  const p = campusId ? [campusId, from, to] : [from, to];
  const cw = campusId ? 'AND campus_id = $1' : '';
  const off = campusId ? 1 : 0;

  const [visits, drugs, referrals] = await Promise.all([
    db.query(
      `SELECT visit_type, is_emergency, COUNT(*) FROM dispensary_visits
       WHERE visit_date BETWEEN $${off+1} AND $${off+2} ${cw} GROUP BY visit_type, is_emergency`,
      p
    ),
    db.query(
      `SELECT di.drug_name, SUM(dd.quantity_given) AS total_dispensed
       FROM drug_dispensed dd JOIN dispensary_visits dv ON dd.visit_id = dv.id
       JOIN drug_inventory di ON dd.drug_id = di.id
       WHERE dv.visit_date BETWEEN $${off+1} AND $${off+2} ${campusId ? 'AND dv.campus_id = $1' : ''}
       GROUP BY di.drug_name ORDER BY total_dispensed DESC LIMIT 10`,
      p
    ),
    db.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='returned') AS returned
       FROM student_referrals
       WHERE referral_date BETWEEN $${off+1} AND $${off+2} ${cw}`,
      p
    ),
  ]);
  return { visits: visits.rows, topDrugs: drugs.rows, referrals: referrals.rows[0] };
}

module.exports = router;
