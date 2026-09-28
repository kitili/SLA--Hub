const express = require('express');
const router  = express.Router();
const db      = require('../db');
const multer  = require('multer');
const path    = require('path');
const { authenticateSession, requireRole, requirePasswordChanged } = require('../middleware/auth');
const { sendSMS, sendEmail }               = require('../middleware/notifications');
const { broadcast } = require('../lib/realtime');
const { BUCKETS, uploadFile, getSignedUrl } = require('../lib/storage');
const { sendServerError, escapeHtml, loadScopedRow, forbiddenOrNotFound, assertCampusAccess } = require('../lib/safe');

router.use(authenticateSession);
router.use(requirePasswordChanged);

const SE_ROLES     = ['global_student_exp_head', 'campus_student_exp_head'];
const GLOBAL_SE    = ['global_student_exp_head'];
router.use(requireRole(...SE_ROLES));

// Photo upload — buffered in memory, then pushed to Supabase Storage (no local disk on Vercel)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).array('photos', 10);

function scopeWhere(scope, alias = '') {
  const a = alias ? `${alias}.` : '';
  return scope.isGlobal
    ? { where: '', params: [] }
    : { where: `WHERE ${a}campus_id = $1`, params: [scope.campusId] };
}

// ── DASHBOARD ────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { scope } = req;
  const p  = scope.isGlobal ? [] : [scope.campusId];
  const cw = scope.isGlobal ? '' : 'WHERE campus_id = $1';

  try {
    const [
      incidentSummary, incidentByLocation, openWalkthroughs,
      behavioural, dispensarySummary, emergencies,
      pendingQuotations, upcomingEvents, campusBreakdown,
    ] = await Promise.all([
      // Incidents by severity + status
      db.query(
        `SELECT severity, status, COUNT(*) FROM student_incidents ${cw} GROUP BY severity, status`,
        p
      ),
      // Incidents by location (heatmap data)
      db.query(
        `SELECT incident_location, severity, COUNT(*) FROM student_incidents
         WHERE created_at >= NOW() - INTERVAL '30 days' ${scope.isGlobal ? '' : 'AND campus_id = $1'}
         GROUP BY incident_location, severity`,
        p
      ),
      // Open high/critical walkthrough items
      db.query(
        `SELECT swf.*, sw.campus_id, sw.walkthrough_date, c.name AS campus_name
         FROM walkthrough_area_findings swf
         JOIN safety_walkthroughs sw ON sw.id = swf.walkthrough_id
         JOIN campuses c ON sw.campus_id = c.id
         WHERE swf.status != 'resolved' AND swf.risk_level IN ('high','critical')
         ${scope.isGlobal ? '' : 'AND sw.campus_id = $1'}
         ORDER BY swf.risk_level DESC, swf.deadline`,
        p
      ),
      // Behavioural escalations this month
      db.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE escalated=TRUE) AS escalated
         FROM behavioural_walkthroughs
         WHERE created_at >= DATE_TRUNC('month', NOW()) ${cw.replace('WHERE', 'AND')}`,
        p
      ),
      // Dispensary summary (read-only view for SE)
      db.query(
        `SELECT COUNT(*) AS visits_today,
                COUNT(*) FILTER (WHERE is_emergency) AS emergencies_today
         FROM dispensary_visits
         WHERE visit_date = CURRENT_DATE ${scope.isGlobal ? '' : 'AND campus_id = $1'}`,
        p
      ),
      // Recent emergencies
      db.query(
        `SELECT dv.*, s.first_name, s.last_name, c.name AS campus_name
         FROM dispensary_visits dv
         JOIN students s ON dv.student_id = s.id
         JOIN campuses c ON dv.campus_id = c.id
         WHERE dv.is_emergency = TRUE
         ${scope.isGlobal ? '' : 'AND dv.campus_id = $1'}
         ORDER BY dv.created_at DESC LIMIT 5`,
        p
      ),
      // Pending quotations (SE head approves)
      db.query(
        `SELECT dq.*, c.name AS campus_name, u.name AS created_by_name
         FROM drug_quotations dq JOIN campuses c ON dq.campus_id = c.id JOIN users u ON dq.created_by = u.id
         WHERE dq.status = 'pending'
         ${scope.isGlobal ? '' : 'AND dq.campus_id = $1'}
         ORDER BY dq.created_at DESC`,
        p
      ),
      // Upcoming events
      db.query(
        `SELECT * FROM school_events WHERE start_date >= CURRENT_DATE
         ${scope.isGlobal ? '' : 'AND (campus_id = $1 OR campus_id IS NULL)'}
         ORDER BY start_date LIMIT 5`,
        p
      ),
      // Campus comparison (global only)
      scope.isGlobal ? db.query(
        `SELECT c.id, c.name,
                COUNT(DISTINCT i.id) AS incidents,
                COUNT(DISTINCT i.id) FILTER (WHERE i.severity IN ('high','critical')) AS critical_incidents,
                COUNT(DISTINCT sw.id) AS walkthroughs,
                COUNT(DISTINCT bw.id) AS behaviour_reports
         FROM campuses c
         LEFT JOIN student_incidents i ON i.campus_id = c.id AND i.created_at >= NOW() - INTERVAL '30 days'
         LEFT JOIN safety_walkthroughs sw ON sw.campus_id = c.id
         LEFT JOIN behavioural_walkthroughs bw ON bw.campus_id = c.id
         GROUP BY c.id, c.name ORDER BY c.name`
      ) : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      incidentSummary:     incidentSummary.rows,
      incidentByLocation:  incidentByLocation.rows,
      openWalkthroughs:    openWalkthroughs.rows,
      behavioural:         behavioural.rows[0],
      dispensary:          dispensarySummary.rows[0],
      recentEmergencies:   emergencies.rows,
      pendingQuotations:   pendingQuotations.rows,
      upcomingEvents:      upcomingEvents.rows,
      campusBreakdown:     campusBreakdown.rows,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── STUDENT SEARCH (for typeahead pickers) ─────────────────────
router.get('/students/search', async (req, res) => {
  const { scope } = req;
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const params = scope.isGlobal ? [`%${q}%`] : [`%${q}%`, scope.campusId];
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.first_name, s.last_name, s.class_name, c.name AS campus_name
       FROM students s JOIN campuses c ON s.campus_id = c.id
       WHERE (s.first_name || ' ' || s.last_name) ILIKE $1 AND s.is_active = TRUE
       ${scope.isGlobal ? '' : 'AND s.campus_id = $2'}
       ORDER BY s.first_name LIMIT 10`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── INCIDENTS ─────────────────────────────────────────────────
router.get('/incidents', async (req, res) => {
  const { scope } = req;
  const { severity, status, location, from, to, page = 1, limit = 50 } = req.query;
  let params = [], conds = [];

  if (!scope.isGlobal) { params.push(scope.campusId); conds.push(`i.campus_id = $${params.length}`); }
  if (severity) { params.push(severity); conds.push(`i.severity = $${params.length}`); }
  if (status)   { params.push(status);   conds.push(`i.status = $${params.length}`); }
  if (location) { params.push(location); conds.push(`i.incident_location = $${params.length}`); }
  if (from)     { params.push(from);     conds.push(`i.created_at >= $${params.length}`); }
  if (to)       { params.push(to);       conds.push(`i.created_at <= $${params.length}`); }

  const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  try {
    const { rows } = await db.query(
      `SELECT i.*, s.first_name, s.last_name, s.class_name, s.parent_name, s.parent_phone,
              c.name AS campus_name, u.name AS reported_by_name
       FROM student_incidents i
       JOIN students s ON i.student_id = s.id
       LEFT JOIN campuses c ON i.campus_id = c.id
       LEFT JOIN users u ON i.reported_by = u.id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/incidents', requireRole(...SE_ROLES), async (req, res) => {
  const {
    student_id, campus_id, incident_type, incident_location, severity,
    description, action_taken, involved_students, witnesses,
    follow_up_required, follow_up_date, parent_notified,
    parent_meeting_required, referral_required,
  } = req.body;

  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  try {
    const { rows } = await db.query(
      `INSERT INTO student_incidents
         (campus_id, student_id, reported_by, incident_type, incident_location, severity,
          description, action_taken, involved_students, witnesses,
          follow_up_required, follow_up_date, parent_notified,
          parent_meeting_required, referral_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [campusId, student_id, req.user.id, incident_type, incident_location, severity,
       description, action_taken, involved_students || [], witnesses,
       follow_up_required || false, follow_up_date || null, parent_notified || false,
       parent_meeting_required || false, referral_required || false]
    );
    const incident = rows[0];

    // Get student details
    const { rows: stu } = await db.query(
      'SELECT first_name, last_name, parent_name, parent_phone, parent2_phone FROM students WHERE id=$1',
      [student_id]
    );
    const student = stu[0];

    // SMS parents for high/critical
    if (student && ['high', 'critical'].includes(severity)) {
      const msg = `${severity === 'critical' ? 'URGENT: ' : ''}Dear ${student.parent_name}, a ${severity} ${incident_type} incident involving ${student.first_name} ${student.last_name} occurred at ${incident_location}. Action: ${action_taken || 'Under review'}. Contact school immediately. - Silverleaf Academy`;
      if (student.parent_phone)  sendSMS({ phone: student.parent_phone,  message: msg });
      if (student.parent2_phone) sendSMS({ phone: student.parent2_phone, message: msg });
    }

    // Real-time broadcast
    broadcast(`campus-${campusId}`, 'incident-alert', {
      id: incident.id, severity, incident_type, incident_location,
      studentName: `${student?.first_name} ${student?.last_name}`,
    });
    if (severity === 'critical') {
      broadcast('global', 'incident-alert', { ...incident, campusId });
    }

    res.json({ success: true, incident });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/incidents/:id', requireRole(...SE_ROLES), async (req, res) => {
  const { status, action_taken, follow_up_date, parent_notified } = req.body;
  try {
    const incident = await loadScopedRow(db, 'student_incidents', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, incident);
    if (blocked) return blocked;

    const { rows } = await db.query(
      `UPDATE student_incidents SET
         status=$1, action_taken=COALESCE($2,action_taken),
         follow_up_date=COALESCE($3,follow_up_date),
         parent_notified=COALESCE($4,parent_notified),
         updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [status, action_taken, follow_up_date, parent_notified, req.params.id]
    );
    res.json({ success: true, incident: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── SAFETY WALKTHROUGHS ───────────────────────────────────────
router.get('/walkthroughs', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT sw.*, c.name AS campus_name, u.name AS conducted_by_name,
              COUNT(swf.id) AS total_areas,
              COUNT(swf.id) FILTER (WHERE swf.status != 'resolved') AS open_items,
              COUNT(swf.id) FILTER (WHERE swf.risk_level IN ('high','critical') AND swf.status != 'resolved') AS critical_open
       FROM safety_walkthroughs sw
       JOIN campuses c ON sw.campus_id = c.id
       LEFT JOIN users u ON sw.conducted_by = u.id
       LEFT JOIN walkthrough_area_findings swf ON swf.walkthrough_id = sw.id
       ${scope.isGlobal ? '' : 'WHERE sw.campus_id = $1'}
       GROUP BY sw.id, c.name, u.name
       ORDER BY sw.walkthrough_date DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/walkthroughs/:id', async (req, res) => {
  try {
    const walkthrough = (await db.query(
      `SELECT sw.*, c.name AS campus_name, u.name AS conducted_by_name
       FROM safety_walkthroughs sw JOIN campuses c ON sw.campus_id = c.id
       LEFT JOIN users u ON sw.conducted_by = u.id WHERE sw.id = $1`,
      [req.params.id]
    )).rows[0];
    if (!walkthrough) return res.status(404).json({ error: 'Not found.' });
    if (!assertCampusAccess(req.scope, walkthrough.campus_id))
      return res.status(403).json({ error: 'Outside your campus scope.' });

    const findings = (await db.query(
      'SELECT * FROM walkthrough_area_findings WHERE walkthrough_id = $1 ORDER BY risk_level DESC',
      [req.params.id]
    )).rows;

    res.json({ ...walkthrough, findings });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/walkthroughs', requireRole(...SE_ROLES), async (req, res) => {
  const { campus_id, walkthrough_date, overall_notes, findings } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  if (walkthrough_date && walkthrough_date > new Date().toISOString().slice(0,10))
    return res.status(400).json({ error: 'Walkthrough date cannot be in the future.' });

  try {
    const { rows: wRows } = await db.query(
      'INSERT INTO safety_walkthroughs (campus_id, conducted_by, walkthrough_date, overall_notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [campusId, req.user.id, walkthrough_date || new Date(), overall_notes]
    );
    const walkthrough = wRows[0];

    for (const f of (findings || [])) {
      await db.query(
        `INSERT INTO walkthrough_area_findings
           (walkthrough_id, area, condition_rating, findings, risk_level,
            corrective_action, responsible_person, deadline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [walkthrough.id, f.area, f.condition_rating, f.findings,
         f.risk_level || 'low', f.corrective_action, f.responsible_person, f.deadline || null]
      );
    }

    // Broadcast critical findings
    const hasCritical = (findings || []).some(f => f.risk_level === 'critical');
    if (hasCritical) {
      broadcast('global', 'critical-walkthrough', { campusId, walkthroughId: walkthrough.id });
    }

    res.json({ success: true, walkthrough });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/walkthroughs/findings/:findingId', requireRole(...SE_ROLES), async (req, res) => {
  const { status, corrective_action } = req.body;
  try {
    const { rows: existing } = await db.query(
      `SELECT f.id, w.campus_id
       FROM walkthrough_area_findings f
       JOIN safety_walkthroughs w ON w.id = f.walkthrough_id
       WHERE f.id = $1`,
      [req.params.findingId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Not found.' });
    if (!assertCampusAccess(req.scope, existing[0].campus_id))
      return res.status(403).json({ error: 'Outside your campus scope.' });

    const { rows } = await db.query(
      'UPDATE walkthrough_area_findings SET status=$1, corrective_action=COALESCE($2,corrective_action), updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, corrective_action, req.params.findingId]
    );
    res.json({ success: true, finding: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// Photo upload for walkthrough findings — `photo_urls` stores Supabase Storage object
// paths, not URLs; signed URLs are generated fresh whenever findings are read back.
router.post('/walkthroughs/findings/:findingId/photos', requireRole(...SE_ROLES), (req, res, next) => {
  upload(req, res, err => { if (err) return res.status(400).json({ error: err.message }); next(); });
}, async (req, res) => {
  try {
    const { rows: existing } = await db.query(
      `SELECT f.id, w.campus_id
       FROM walkthrough_area_findings f
       JOIN safety_walkthroughs w ON w.id = f.walkthrough_id
       WHERE f.id = $1`,
      [req.params.findingId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Not found.' });
    if (!assertCampusAccess(req.scope, existing[0].campus_id))
      return res.status(403).json({ error: 'Outside your campus scope.' });

    const paths = await Promise.all(req.files.map(f => {
      const objectPath = `se-${Date.now()}-${Math.random().toString(36).slice(2,8)}${path.extname(f.originalname)}`;
      return uploadFile(BUCKETS.walkthroughPhotos, objectPath, f.buffer, f.mimetype);
    }));
    const { rows } = await db.query(
      'UPDATE walkthrough_area_findings SET photo_urls = photo_urls || $1 WHERE id = $2 RETURNING photo_urls',
      [paths, req.params.findingId]
    );
    const signedUrls = await Promise.all(rows[0].photo_urls.map(p => getSignedUrl(BUCKETS.walkthroughPhotos, p)));
    res.json({ success: true, photos: signedUrls });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── BEHAVIOURAL WALKTHROUGHS ──────────────────────────────────
router.get('/behaviour', async (req, res) => {
  const { scope } = req;
  const { student_id, escalated } = req.query;
  let params = [], conds = [];

  if (!scope.isGlobal) { params.push(scope.campusId); conds.push(`bw.campus_id = $${params.length}`); }
  if (student_id) { params.push(student_id); conds.push(`bw.student_id = $${params.length}`); }
  if (escalated === 'true') { conds.push(`bw.escalated = TRUE`); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const { rows } = await db.query(
      `SELECT bw.*, s.first_name, s.last_name, s.class_name,
              u.name AS observer_name, c.name AS campus_name
       FROM behavioural_walkthroughs bw
       JOIN students s ON bw.student_id = s.id
       JOIN campuses c ON bw.campus_id = c.id
       LEFT JOIN users u ON bw.observed_by = u.id
       ${where} ORDER BY bw.observed_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/behaviour', requireRole(...SE_ROLES), async (req, res) => {
  const {
    campus_id, student_id, setting, behaviour_categories, description,
    frequency, trigger_identified, trigger_description, intervention,
    intervention_outcome, parent_contacted, parent_contact_date,
    follow_up_date, escalated, escalation_notes,
  } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;

  try {
    const { rows } = await db.query(
      `INSERT INTO behavioural_walkthroughs
         (campus_id, student_id, observed_by, setting, behaviour_categories, description,
          frequency, trigger_identified, trigger_description, intervention,
          intervention_outcome, parent_contacted, parent_contact_date,
          follow_up_date, escalated, escalation_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [campusId, student_id, req.user.id, setting,
       behaviour_categories || [], description, frequency,
       trigger_identified || false, trigger_description, intervention,
       intervention_outcome, parent_contacted || false, parent_contact_date || null,
       follow_up_date || null, escalated || false, escalation_notes]
    );

    // Notify global SE head on escalation
    if (escalated) {
      broadcast('global', 'behaviour-escalation', {
        studentId: student_id, campusId, recordId: rows[0].id,
      });
    }

    res.json({ success: true, record: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── EVENTS & ACTIVITIES REPORTS ───────────────────────────────
router.get('/event-reports', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT ear.*, c.name AS campus_name, u.name AS reported_by_name, se.title AS linked_event
       FROM event_activity_reports ear
       JOIN campuses c ON ear.campus_id = c.id
       LEFT JOIN users u ON ear.reported_by = u.id
       LEFT JOIN school_events se ON ear.school_event_id = se.id
       ${scope.isGlobal ? '' : 'WHERE ear.campus_id = $1'}
       ORDER BY ear.report_date DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/event-reports', requireRole(...SE_ROLES), async (req, res) => {
  const {
    campus_id, school_event_id, event_name, report_date, venue,
    student_count, staff_count, activities_conducted, engagement_level,
    incidents_occurred, incident_ids, health_safety_notes, recommendations, overall_rating,
  } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;
  const ratio = student_count && staff_count ? (student_count / staff_count).toFixed(2) : null;

  if (report_date && report_date > new Date().toISOString().slice(0,10))
    return res.status(400).json({ error: 'Event report date cannot be in the future.' });

  try {
    const { rows } = await db.query(
      `INSERT INTO event_activity_reports
         (campus_id, school_event_id, event_name, report_date, venue,
          student_count, staff_count, supervision_ratio, activities_conducted,
          engagement_level, incidents_occurred, incident_ids,
          health_safety_notes, recommendations, overall_rating, reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [campusId, school_event_id || null, event_name, report_date || new Date(),
       venue, student_count || null, staff_count || null, ratio, activities_conducted, engagement_level,
       incidents_occurred || false, incident_ids || [], health_safety_notes,
       recommendations, overall_rating || null, req.user.id]
    );
    res.json({ success: true, report: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── DISPENSARY (read-only view for SE) ────────────────────────
router.get('/dispensary/visits', async (req, res) => {
  const { scope } = req;
  const { from, to, is_emergency } = req.query;
  let params = [], conds = [];

  if (!scope.isGlobal) { params.push(scope.campusId); conds.push(`dv.campus_id = $${params.length}`); }
  if (from)         { params.push(from);  conds.push(`dv.visit_date >= $${params.length}`); }
  if (to)           { params.push(to);    conds.push(`dv.visit_date <= $${params.length}`); }
  if (is_emergency === 'true') { conds.push(`dv.is_emergency = TRUE`); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  try {
    const { rows } = await db.query(
      `SELECT dv.*, s.first_name, s.last_name, s.class_name, s.parent_name,
              u.name AS nurse_name, c.name AS campus_name
       FROM dispensary_visits dv
       JOIN students s ON dv.student_id = s.id
       LEFT JOIN users u ON dv.nurse_id = u.id
       LEFT JOIN campuses c ON dv.campus_id = c.id
       ${where} ORDER BY dv.visit_date DESC, dv.visit_time DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/dispensary/inventory', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT di.*, c.name AS campus_name, dc.name AS category_name,
              CASE WHEN di.quantity <= di.minimum_stock THEN TRUE ELSE FALSE END AS low_stock,
              CASE WHEN di.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN TRUE ELSE FALSE END AS expiring_soon
       FROM drug_inventory di
       LEFT JOIN campuses c ON di.campus_id = c.id
       LEFT JOIN drug_categories dc ON di.category_id = dc.id
       ${scope.isGlobal ? '' : 'WHERE di.campus_id = $1'}
       ORDER BY di.drug_name`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

// SE approves/rejects drug quotations
router.patch('/dispensary/quotations/:id/status', requireRole(...GLOBAL_SE), async (req, res) => {
  const { status, review_notes } = req.body;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ error: 'Status must be approved or rejected.' });
  try {
    const quotation = await loadScopedRow(db, 'drug_quotations', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, quotation);
    if (blocked) return blocked;

    const { rows } = await db.query(
      `UPDATE drug_quotations SET status=$1, reviewed_by=$2, reviewed_at=NOW(), review_notes=$3
       WHERE id=$4 RETURNING *`,
      [status, req.user.id, review_notes || '', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found.' });

    // Notify nurse
    const nurse = (await db.query('SELECT u.email, u.name FROM users u WHERE u.id = $1', [rows[0].created_by])).rows[0];
    if (nurse?.email) {
      sendEmail({
        to: nurse.email,
        subject: `Drug Quotation ${status} — Silverleaf Academy`,
        html: `<p>Dear ${escapeHtml(nurse.name)}, your drug quotation "<strong>${escapeHtml(rows[0].title)}</strong>" has been <strong>${escapeHtml(status)}</strong>. ${review_notes ? 'Notes: ' + escapeHtml(review_notes) : ''} - SE Department</p>`,
      });
    }

    res.json({ success: true, quotation: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── SCHOOL EVENTS (SE read + write) ──────────────────────────
router.get('/events', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT * FROM school_events
       ${scope.isGlobal ? '' : 'WHERE campus_id = $1 OR campus_id IS NULL'}
       ORDER BY start_date`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/events', requireRole(...SE_ROLES), async (req, res) => {
  const { campus_id, title, description, event_type, start_date, end_date, start_time, location } = req.body;
  const campusId = req.scope.isGlobal ? campus_id : req.scope.campusId;
  try {
    const { rows } = await db.query(
      `INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, start_time, location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [campusId || null, title, description, event_type, start_date, end_date || null, start_time || null, location, req.user.id]
    );
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── ANALYTICS ─────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  const { scope } = req;
  const { period = 'monthly' } = req.query;
  const p  = scope.isGlobal ? [] : [scope.campusId];
  const cw = scope.isGlobal ? '' : 'WHERE campus_id = $1';
  const interval = { daily: '1 day', weekly: '7 days', monthly: '30 days', yearly: '365 days' }[period] || '30 days';

  try {
    const [incidentTrend, locationBreakdown, behaviourFreq, walkScore] = await Promise.all([
      db.query(
        `SELECT DATE_TRUNC('week', created_at) AS week, severity, COUNT(*) FROM student_incidents
         ${cw} AND created_at >= NOW() - INTERVAL '${interval}' GROUP BY 1,2 ORDER BY 1`,
        p
      ),
      db.query(
        `SELECT incident_location, COUNT(*) FROM student_incidents ${cw} GROUP BY incident_location`,
        p
      ),
      db.query(
        `SELECT intervention, COUNT(*) FROM behavioural_walkthroughs
         ${cw} AND created_at >= NOW() - INTERVAL '${interval}' GROUP BY intervention`,
        p
      ),
      db.query(
        `SELECT ROUND(AVG(swf.condition_rating),2) AS avg_score, swf.area
         FROM walkthrough_area_findings swf
         JOIN safety_walkthroughs sw ON sw.id = swf.walkthrough_id
         WHERE sw.walkthrough_date >= NOW() - INTERVAL '${interval}'
         ${scope.isGlobal ? '' : 'AND sw.campus_id = $1'}
         GROUP BY swf.area`,
        p
      ),
    ]);

    res.json({
      incidentTrend:    incidentTrend.rows,
      locationBreakdown: locationBreakdown.rows,
      behaviourFreq:    behaviourFreq.rows,
      walkScore:        walkScore.rows,
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
