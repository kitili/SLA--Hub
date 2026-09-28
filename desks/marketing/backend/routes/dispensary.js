const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authenticateSession, requireRole, requirePasswordChanged } = require('../middleware/auth');
const { sendEmail, sendSMS }               = require('../middleware/notifications');
const { broadcast } = require('../lib/realtime');
const { sendServerError, escapeHtml, loadScopedRow, forbiddenOrNotFound, assertCampusAccess } = require('../lib/safe');

router.use(authenticateSession);
router.use(requirePasswordChanged);

const NURSE_ROLES = ['nurse'];
const ALL_DISP    = ['nurse', 'global_student_exp_head', 'campus_student_exp_head'];
router.use(requireRole(...ALL_DISP));

// ── DASHBOARD ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { scope } = req;
  const p  = scope.isGlobal ? [] : [scope.campusId];
  const cw = scope.isGlobal ? '' : 'WHERE campus_id = $1';

  try {
    const [todayVisits, inventory, lowStock, expiring, emergencies, chronic, quotations, topComplaints] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_emergency) AS emergencies,
                COUNT(*) FILTER (WHERE visit_type='follow_up') AS follow_ups
         FROM dispensary_visits WHERE visit_date = CURRENT_DATE ${scope.isGlobal ? '' : 'AND campus_id = $1'}`,
        p
      ),
      db.query(
        `SELECT COUNT(*) AS total_drugs, SUM(quantity) AS total_units,
                SUM(CASE WHEN quantity <= minimum_stock THEN 1 ELSE 0 END) AS low_count
         FROM drug_inventory ${cw}`,
        p
      ),
      db.query(
        `SELECT di.drug_name, di.quantity, di.minimum_stock, di.expiry_date, c.name AS campus_name
         FROM drug_inventory di LEFT JOIN campuses c ON di.campus_id = c.id
         WHERE di.quantity <= di.minimum_stock ${scope.isGlobal ? '' : 'AND di.campus_id = $1'}
         ORDER BY di.quantity LIMIT 10`,
        p
      ),
      db.query(
        `SELECT drug_name, quantity, expiry_date, campus_id,
                expiry_date - CURRENT_DATE AS days_until_expiry
         FROM drug_inventory WHERE expiry_date <= CURRENT_DATE + INTERVAL '90 days'
         ${scope.isGlobal ? '' : 'AND campus_id = $1'}
         ORDER BY expiry_date LIMIT 20`,
        p
      ),
      db.query(
        `SELECT dv.*, s.first_name, s.last_name, c.name AS campus_name
         FROM dispensary_visits dv JOIN students s ON dv.student_id = s.id
         JOIN campuses c ON dv.campus_id = c.id
         WHERE dv.is_emergency = TRUE ${scope.isGlobal ? '' : 'AND dv.campus_id = $1'}
         ORDER BY dv.created_at DESC LIMIT 10`,
        p
      ),
      db.query(
        `SELECT cvf.*, s.first_name, s.last_name, c.name AS campus_name
         FROM chronic_visit_flags cvf JOIN students s ON cvf.student_id = s.id
         JOIN campuses c ON cvf.campus_id = c.id
         WHERE cvf.acknowledged = FALSE ${scope.isGlobal ? '' : 'AND cvf.campus_id = $1'}`,
        p
      ),
      db.query(
        `SELECT dq.*, c.name AS campus_name, u.name AS created_by_name
         FROM drug_quotations dq JOIN campuses c ON dq.campus_id = c.id JOIN users u ON dq.created_by = u.id
         ${scope.isGlobal ? '' : 'WHERE dq.campus_id = $1'} ORDER BY dq.created_at DESC LIMIT 5`,
        p
      ),
      db.query(
        `SELECT complaint, COUNT(*) AS count FROM dispensary_visits
         WHERE visit_date >= NOW() - INTERVAL '30 days' ${scope.isGlobal ? '' : 'AND campus_id = $1'}
         GROUP BY complaint ORDER BY count DESC LIMIT 10`,
        p
      ),
    ]);

    res.json({
      today:         todayVisits.rows[0],
      inventory:     inventory.rows[0],
      lowStock:      lowStock.rows,
      expiring:      expiring.rows,
      emergencies:   emergencies.rows,
      chronic:       chronic.rows,
      quotations:    quotations.rows,
      topComplaints: topComplaints.rows,
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

// ── INVENTORY ─────────────────────────────────────────────────
router.get('/inventory', async (req, res) => {
  const { scope } = req;
  const { category_id } = req.query;
  let params = [], conds = [];
  if (!scope.isGlobal) { params.push(scope.campusId); conds.push(`di.campus_id = $${params.length}`); }
  if (category_id)     { params.push(category_id);   conds.push(`di.category_id = $${params.length}`); }

  try {
    const { rows } = await db.query(
      `SELECT di.*, c.name AS campus_name, dc.name AS category_name,
              di.quantity <= di.minimum_stock AS low_stock,
              di.expiry_date <= CURRENT_DATE AS expired,
              di.expiry_date <= CURRENT_DATE + INTERVAL '30 days' AS expiring_soon
       FROM drug_inventory di
       LEFT JOIN campuses c ON di.campus_id = c.id
       LEFT JOIN drug_categories dc ON di.category_id = dc.id
       ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
       ORDER BY di.drug_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/inventory', requireRole(...NURSE_ROLES), async (req, res) => {
  const { drug_name, category_id, quantity, unit, expiry_date, minimum_stock, reorder_quantity, storage_location, supplier } = req.body;
  const campusId = req.scope.campusId;
  if (!campusId) return res.status(400).json({ error: 'Campus required.' });

  try {
    const { rows } = await db.query(
      `INSERT INTO drug_inventory (campus_id, category_id, drug_name, quantity, unit, expiry_date, minimum_stock, reorder_quantity, storage_location, supplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [campusId, category_id || null, drug_name, quantity || 0, unit, expiry_date || null, minimum_stock || 10, reorder_quantity || 50, storage_location, supplier]
    );
    res.json({ success: true, drug: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/inventory/:id', requireRole(...NURSE_ROLES), async (req, res) => {
  const { quantity, minimum_stock, expiry_date, storage_location } = req.body;
  try {
    const { rows: existing } = await db.query('SELECT campus_id FROM drug_inventory WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Drug not found.' });
    if (!req.scope.isGlobal && String(existing[0].campus_id) !== String(req.scope.campusId)) {
      return res.status(403).json({ error: 'Drug is outside your campus scope.' });
    }

    const { rows } = await db.query(
      `UPDATE drug_inventory SET
         quantity         = COALESCE($1, quantity),
         minimum_stock    = COALESCE($2, minimum_stock),
         expiry_date      = COALESCE($3, expiry_date),
         storage_location = COALESCE($4, storage_location),
         updated_at       = NOW()
       WHERE id = $5 RETURNING *`,
      [quantity, minimum_stock, expiry_date, storage_location, req.params.id]
    );
    res.json({ success: true, drug: rows[0] });
  } catch (err) {
    console.error('Patch inventory error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PURCHASES ─────────────────────────────────────────────────
router.get('/purchases', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT dp.*, di.drug_name, u.name AS received_by_name, c.name AS campus_name
       FROM drug_purchases dp
       JOIN drug_inventory di ON dp.drug_id = di.id
       JOIN users u ON dp.received_by = u.id
       JOIN campuses c ON dp.campus_id = c.id
       ${scope.isGlobal ? '' : 'WHERE dp.campus_id = $1'}
       ORDER BY dp.created_at DESC LIMIT 100`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/purchases', requireRole(...NURSE_ROLES), async (req, res) => {
  const { drug_id, quantity_purchased, unit_cost, supplier, invoice_number } = req.body;
  const campusId = req.scope.campusId;

  try {
    const drug = await loadScopedRow(db, 'drug_inventory', drug_id, req.scope);
    const blocked = forbiddenOrNotFound(res, drug);
    if (blocked) return blocked;

    const total = quantity_purchased * (unit_cost || 0);
    await db.query(
      `INSERT INTO drug_purchases (campus_id, drug_id, quantity_purchased, unit_cost, total_cost, supplier, received_by, invoice_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [campusId || drug.campus_id, drug_id, quantity_purchased, unit_cost || null, total, supplier, req.user.id, invoice_number]
    );
    await db.query(
      'UPDATE drug_inventory SET quantity = quantity + $1, last_restocked = CURRENT_DATE, updated_at = NOW() WHERE id = $2',
      [quantity_purchased, drug_id]
    );
    res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── VISITS ────────────────────────────────────────────────────
router.get('/visits', async (req, res) => {
  const { scope } = req;
  const { from, to, visit_type, is_emergency, page = 1, limit = 50 } = req.query;
  let params = [], conds = [];

  if (!scope.isGlobal) { params.push(scope.campusId); conds.push(`dv.campus_id = $${params.length}`); }
  if (from)         { params.push(from);  conds.push(`dv.visit_date >= $${params.length}`); }
  if (to)           { params.push(to);    conds.push(`dv.visit_date <= $${params.length}`); }
  if (visit_type)   { params.push(visit_type);   conds.push(`dv.visit_type = $${params.length}`); }
  if (is_emergency === 'true') { conds.push(`dv.is_emergency = TRUE`); }

  const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  try {
    const { rows } = await db.query(
      `SELECT dv.*, s.first_name, s.last_name, s.class_name, s.parent_name, s.parent_phone,
              u.name AS nurse_name, c.name AS campus_name
       FROM dispensary_visits dv
       JOIN students s ON dv.student_id = s.id
       LEFT JOIN users u ON dv.nurse_id = u.id
       LEFT JOIN campuses c ON dv.campus_id = c.id
       ${where}
       ORDER BY dv.visit_date DESC, dv.visit_time DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/visits', requireRole(...NURSE_ROLES), async (req, res) => {
  const {
    student_id, visit_type, complaint, diagnosis, prescription, remarks,
    temperature, blood_pressure, weight, is_emergency, drugs_dispensed,
  } = req.body;
  const campusId = req.scope.campusId;

  try {
    const { rows: visitRows } = await db.query(
      `INSERT INTO dispensary_visits
         (campus_id, student_id, nurse_id, visit_type, complaint, diagnosis,
          prescription, remarks, temperature, blood_pressure, weight, is_emergency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [campusId, student_id, req.user.id, visit_type || 'walk_in',
       complaint, diagnosis, prescription, remarks,
       temperature || null, blood_pressure, weight || null, is_emergency || false]
    );
    const visit = visitRows[0];

    // Dispense drugs
    if (drugs_dispensed?.length) {
      for (const d of drugs_dispensed) {
        await db.query(
          'INSERT INTO drug_dispensed (visit_id, drug_id, quantity_given, dosage_instructions) VALUES ($1,$2,$3,$4)',
          [visit.id, d.drug_id, d.quantity, d.instructions]
        );
        await db.query(
          'UPDATE drug_inventory SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
          [d.quantity, d.drug_id]
        );
      }
    }

    // Emergency handling
    if (is_emergency) {
      const { rows: stu } = await db.query(
        `SELECT s.*, c.name AS campus_name FROM students s JOIN campuses c ON s.campus_id = c.id WHERE s.id = $1`,
        [student_id]
      );
      const student = stu[0];

      if (student) {
        const smsMsg = `URGENT: ${student.first_name} ${student.last_name} has a medical emergency at ${student.campus_name}. Complaint: ${complaint}. Contact school immediately. - Silverleaf Academy`;
        if (student.parent_phone)  sendSMS({ phone: student.parent_phone,  message: smsMsg });
        if (student.parent2_phone) sendSMS({ phone: student.parent2_phone, message: smsMsg });

        // Alert SE heads
        const { rows: seHeads } = await db.query(
          `SELECT email, name FROM users WHERE role IN ('global_student_exp_head','campus_student_exp_head')
           AND (campus_id = $1 OR campus_id IS NULL) AND is_active = TRUE`,
          [campusId]
        );
        for (const head of seHeads) {
          sendEmail({
            to: head.email,
            subject: `🚨 EMERGENCY: ${student.first_name} ${student.last_name} — Silverleaf`,
            html: `<p><strong>EMERGENCY DISPENSARY VISIT</strong></p><p>Student: ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)} (${escapeHtml(student.class_name)})</p><p>Campus: ${escapeHtml(student.campus_name)}</p><p>Complaint: ${escapeHtml(complaint)}</p><p>Time: ${escapeHtml(new Date().toLocaleString('en-GB'))}</p>`,
          });
        }

        // Real-time alert
        broadcast(`campus-${campusId}`, 'dispensary-emergency', {
          studentName: `${student.first_name} ${student.last_name}`,
          complaint, campusId, visitId: visit.id,
        });
        broadcast('global', 'dispensary-emergency', {
          studentName: `${student.first_name} ${student.last_name}`,
          complaint, campusId, visitId: visit.id,
        });

        await db.query('UPDATE dispensary_visits SET emergency_contacts_notified = TRUE WHERE id = $1', [visit.id]);
      }
    }

    // Low stock check
    const { rows: lowStock } = await db.query(
      `SELECT drug_name, quantity, minimum_stock FROM drug_inventory
       WHERE campus_id = $1 AND quantity <= minimum_stock LIMIT 5`,
      [campusId]
    );
    if (lowStock.length) {
      broadcast(`campus-${campusId}`, 'low-stock-alert', { drugs: lowStock });
    }

    res.json({ success: true, visit });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── REFERRALS ─────────────────────────────────────────────────
router.get('/referrals', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT sr.*, s.first_name, s.last_name, s.class_name,
              u.name AS referred_by_name, c.name AS campus_name
       FROM student_referrals sr JOIN students s ON sr.student_id = s.id
       LEFT JOIN users u ON sr.referred_by = u.id JOIN campuses c ON sr.campus_id = c.id
       ${scope.isGlobal ? '' : 'WHERE sr.campus_id = $1'}
       ORDER BY sr.referral_date DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/referrals', requireRole(...NURSE_ROLES), async (req, res) => {
  const { student_id, visit_id, reason, referred_to, expected_return_date } = req.body;
  const campusId = req.scope.campusId;

  try {
    const { rows } = await db.query(
      `INSERT INTO student_referrals (campus_id, student_id, visit_id, referred_by, reason, referred_to, expected_return_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [campusId, student_id, visit_id || null, req.user.id, reason, referred_to, expected_return_date || null]
    );
    if (visit_id) {
      await db.query('UPDATE dispensary_visits SET referred_out=TRUE, referral_id=$1 WHERE id=$2', [rows[0].id, visit_id]);
    }
    res.json({ success: true, referral: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/referrals/:id', requireRole(...NURSE_ROLES), async (req, res) => {
  const { outcome, outcome_date, status } = req.body;
  try {
    const referral = await loadScopedRow(db, 'student_referrals', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, referral);
    if (blocked) return blocked;

    const { rows } = await db.query(
      'UPDATE student_referrals SET outcome=$1, outcome_date=$2, status=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [outcome, outcome_date, status, req.params.id]
    );
    res.json({ success: true, referral: rows[0] });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── CHRONIC FLAGS ─────────────────────────────────────────────
router.get('/chronic', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT cvf.*, s.first_name, s.last_name, s.class_name, c.name AS campus_name
       FROM chronic_visit_flags cvf JOIN students s ON cvf.student_id = s.id JOIN campuses c ON cvf.campus_id = c.id
       WHERE cvf.acknowledged = FALSE ${scope.isGlobal ? '' : 'AND cvf.campus_id = $1'}`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.patch('/chronic/:id/acknowledge', requireRole(...ALL_DISP), async (req, res) => {
  try {
    const flag = await loadScopedRow(db, 'chronic_visit_flags', req.params.id, req.scope);
    const blocked = forbiddenOrNotFound(res, flag);
    if (blocked) return blocked;

    await db.query(
      'UPDATE chronic_visit_flags SET acknowledged=TRUE, ack_by=$1, ack_at=NOW() WHERE id=$2',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── QUOTATIONS ────────────────────────────────────────────────
router.get('/quotations', async (req, res) => {
  const { scope } = req;
  try {
    const { rows } = await db.query(
      `SELECT dq.*, c.name AS campus_name, u.name AS created_by_name,
              r.name AS reviewed_by_name, COUNT(dqi.id)::int AS item_count
       FROM drug_quotations dq
       LEFT JOIN campuses c ON dq.campus_id = c.id
       LEFT JOIN users u ON dq.created_by = u.id
       LEFT JOIN users r ON dq.reviewed_by = r.id
       LEFT JOIN drug_quotation_items dqi ON dqi.quotation_id = dq.id
       ${scope.isGlobal ? '' : 'WHERE dq.campus_id = $1'}
       GROUP BY dq.id, c.name, u.name, r.name
       ORDER BY dq.created_at DESC`,
      scope.isGlobal ? [] : [scope.campusId]
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/quotations/:id', async (req, res) => {
  try {
    const q = (await db.query(
      `SELECT dq.*, c.name AS campus_name, u.name AS created_by_name
       FROM drug_quotations dq LEFT JOIN campuses c ON dq.campus_id = c.id
       LEFT JOIN users u ON dq.created_by = u.id WHERE dq.id = $1`,
      [req.params.id]
    )).rows[0];
    if (!q) return res.status(404).json({ error: 'Not found.' });
    const items = (await db.query('SELECT * FROM drug_quotation_items WHERE quotation_id=$1 ORDER BY id', [req.params.id])).rows;
    res.json({ ...q, items });
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/quotations', requireRole(...NURSE_ROLES), async (req, res) => {
  const { title, notes, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Add at least one item.' });
  const campusId = req.scope.campusId;

  try {
    const totalCost = items.reduce((sum, i) => sum + (parseFloat(i.estimated_unit_cost || 0) * parseInt(i.quantity_needed || 0)), 0);

    const { rows } = await db.query(
      'INSERT INTO drug_quotations (campus_id, created_by, title, notes, total_estimated_cost) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [campusId, req.user.id, title, notes, totalCost]
    );
    const quotation = rows[0];

    for (const item of items) {
      await db.query(
        `INSERT INTO drug_quotation_items (quotation_id, drug_name, quantity_needed, unit, estimated_unit_cost, estimated_total, supplier_suggestion, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [quotation.id, item.drug_name, item.quantity_needed, item.unit || 'tablets',
         item.estimated_unit_cost, (item.estimated_unit_cost || 0) * (item.quantity_needed || 0),
         item.supplier_suggestion, item.notes]
      );
    }

    // Email SE global heads (they approve, not CEO)
    const { rows: seHeads } = await db.query(
      `SELECT email, name FROM users WHERE role = 'global_student_exp_head' AND is_active = TRUE`
    );
    const campus = (await db.query('SELECT name FROM campuses WHERE id=$1', [campusId])).rows[0];

    for (const head of seHeads) {
      sendEmail({
        to: head.email,
        subject: `Drug Quotation Awaiting Approval — ${campus?.name}`,
        html: `<p>Dear ${escapeHtml(head.name)}, a drug quotation "<strong>${escapeHtml(title)}</strong>" from ${escapeHtml(campus?.name)} requires your approval. Total: TZS ${escapeHtml(totalCost.toLocaleString())}. Please review in the system.</p>`,
      });
    }

    await db.query('UPDATE drug_quotations SET email_sent=TRUE WHERE id=$1', [quotation.id]);
    res.json({ success: true, quotation: { ...quotation, item_count: items.length } });
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── DRUG CATEGORIES ───────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM drug_categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

// ── STATS / ANALYTICS ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const { scope } = req;
  const { period = 'monthly' } = req.query;
  const p  = scope.isGlobal ? [] : [scope.campusId];
  const cw = scope.isGlobal ? '' : 'WHERE campus_id = $1';
  const interval = { daily: '1 day', weekly: '7 days', monthly: '30 days', yearly: '365 days' }[period] || '30 days';

  try {
    const [visitTrend, commonComplaints, drugUsage, refStats] = await Promise.all([
      db.query(
        `SELECT DATE_TRUNC('week', visit_date) AS week,
                COUNT(*) AS visits, COUNT(*) FILTER (WHERE is_emergency) AS emergencies
         FROM dispensary_visits ${cw ? `${cw} AND` : 'WHERE'} visit_date >= NOW() - INTERVAL '${interval}'
         GROUP BY 1 ORDER BY 1`,
        p
      ),
      db.query(
        `SELECT complaint, COUNT(*) AS count FROM dispensary_visits
         WHERE visit_date >= NOW() - INTERVAL '${interval}' ${scope.isGlobal ? '' : 'AND campus_id = $1'}
         GROUP BY complaint ORDER BY count DESC LIMIT 10`,
        p
      ),
      db.query(
        `SELECT di.drug_name, SUM(dd.quantity_given) AS total_dispensed
         FROM drug_dispensed dd JOIN dispensary_visits dv ON dd.visit_id = dv.id
         JOIN drug_inventory di ON dd.drug_id = di.id
         WHERE dv.visit_date >= NOW() - INTERVAL '${interval}'
         ${scope.isGlobal ? '' : 'AND dv.campus_id = $1'}
         GROUP BY di.drug_name ORDER BY total_dispensed DESC LIMIT 10`,
        p
      ),
      db.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status='returned') AS returned,
                COUNT(*) FILTER (WHERE status='pending') AS pending
         FROM student_referrals
         WHERE referral_date >= NOW() - INTERVAL '${interval}' ${scope.isGlobal ? '' : 'AND campus_id = $1'}`,
        p
      ),
    ]);

    res.json({
      visitTrend:       visitTrend.rows,
      commonComplaints: commonComplaints.rows,
      drugUsage:        drugUsage.rows,
      referrals:        refStats.rows[0],
    });
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
