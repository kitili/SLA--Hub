/**
 * Recommend-loop: draft an action, wait for staff approve, then maybe send.
 * Never writes to Ed Admin. Never sends without an approve row.
 */

const db = require('../db');
const { attachVitality } = require('./leadVitality');
const { sendEmail, sendSMS, sendWhatsApp } = require('../middleware/notifications');
const { messaging } = require('./readiness');
const { escapeHtml } = require('./safe');

const ALLOWED = ['send_whatsapp', 'send_sms', 'send_email', 'send_form_link', 'mark_dead', 'log_contact'];
const EDADMIN_APPLICATION_URL = 'https://silverleafacademy.ed-space.net/onlineapplication.cfm';

const LEAD_SQL = `
  SELECT l.*, c.name AS campus_name, c.code AS campus_code,
         EXISTS(SELECT 1 FROM tour_bookings WHERE lead_id = l.id) AS has_tour,
         EXISTS(SELECT 1 FROM admission_applications WHERE lead_id = l.id) AS has_application,
         EXISTS(SELECT 1 FROM admission_payments WHERE lead_id = l.id) AS has_payment,
         (SELECT outcome FROM interview_bookings WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) AS interview_outcome,
         (SELECT COUNT(*)::int FROM tour_bookings t WHERE t.lead_id = l.id AND t.status = 'no_show') AS tour_no_shows,
         (SELECT COUNT(*)::int FROM follow_up_tasks ft WHERE ft.lead_id = l.id AND ft.status = 'done') AS followups_done,
         (SELECT step FROM lead_form_reminders r WHERE r.lead_id = l.id) AS form_reminder_step
  FROM marketing_leads l
  LEFT JOIN campuses c ON l.campus_id = c.id`;

function draftMessage(lead, actionType) {
  const child = lead.child_name || 'your child';
  const next = lead.vitality?.next || 'We would like to follow up on the admission inquiry.';
  if (actionType === 'send_form_link') {
    return `Dear ${lead.parent_name}, congratulations! ${child} has passed the admission interview at Silverleaf Academy. Please complete the online admission application here: ${EDADMIN_APPLICATION_URL}?ref=${lead.id}`;
  }
  if (actionType === 'mark_dead') {
    return next;
  }
  return `Dear ${lead.parent_name}, this is Silverleaf Academy regarding ${child}. ${next}`;
}

function defaultActionType(lead) {
  const v = lead.vitality || {};
  if (v.status === 'dead' || v.auto_dead) return 'mark_dead';
  if (lead.interview_outcome === 'passed' && !lead.has_application) return 'send_form_link';
  if (lead.whatsapp_number || lead.parent_phone) return 'send_whatsapp';
  if (lead.parent_email) return 'send_email';
  return 'log_contact';
}

async function loadLead(leadId) {
  const { rows } = await db.query(`${LEAD_SQL} WHERE l.id = $1 AND l.is_archived = FALSE`, [leadId]);
  if (!rows[0]) return null;
  return attachVitality(rows[0]);
}

async function buildQueue(scope, limit = 40, query = {}) {
  const params = [];
  const campusId = scope.isGlobal
    ? (Number.parseInt(query.campus_id, 10) || null)
    : scope.campusId;
  const campus = Number.isInteger(campusId) && campusId > 0 ? ' AND l.campus_id = $1' : '';
  if (campus) params.push(campusId);
  const { rows } = await db.query(
    `${LEAD_SQL}
     WHERE l.is_archived = FALSE
       AND l.computed_stage NOT IN ('admission_paid','enrolled','declined','lapsed')
       ${campus}
     ORDER BY l.updated_at ASC
     LIMIT ${Number(limit) * 3}`,
    params
  );
  return rows
    .map(attachVitality)
    .filter((lead) => {
      const s = lead.vitality?.status;
      return ['hot', 'cold', 'dead'].includes(s) || lead.vitality?.auto_dead;
    })
    .slice(0, Number(limit))
    .map((lead) => ({
      ...lead,
      suggested_action: defaultActionType(lead),
      draft: draftMessage(lead, defaultActionType(lead)),
    }));
}

async function propose({ lead, actionType, proposedBy, notes }) {
  if (!ALLOWED.includes(actionType)) {
    const err = new Error('Unknown action type.');
    err.status = 400;
    throw err;
  }
  const draft = draftMessage(lead, actionType);
  const payload = { draft, notes: notes || null };
  const { rows } = await db.query(
    `INSERT INTO agent_actions
       (lead_id, campus_id, action_type, status, payload, proposed_by)
     VALUES ($1,$2,$3,'pending',$4,$5)
     RETURNING *`,
    [lead.id, lead.campus_id, actionType, payload, proposedBy]
  );
  return rows[0];
}

function payloadOf(action) {
  const raw = action?.payload;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

async function executeAction(action, reviewerId) {
  const lead = await loadLead(action.lead_id);
  if (!lead) return { status: 'skipped', result: 'Lead not found or archived.' };

  const draft = payloadOf(action).draft || draftMessage(lead, action.action_type);
  const msg = messaging();

  if (action.action_type === 'mark_dead') {
    await db.query(
      `UPDATE marketing_leads
          SET computed_stage = 'dead_lead',
              dead_reason = COALESCE(dead_reason, 'Approved inactivity'),
              updated_at = NOW()
        WHERE id = $1
          AND computed_stage = 'interested_lead'`,
      [lead.id]
    );
    return { status: 'executed', result: 'Lead marked dead.' };
  }

  if (action.action_type === 'log_contact') {
    await db.query(
      `INSERT INTO lead_contact_attempts (lead_id, channel, outcome, notes, created_by)
       VALUES ($1,'phone','left_message',$2,$3)`,
      [lead.id, draft, reviewerId]
    );
    await db.query(
      `UPDATE marketing_leads SET last_contacted_at = NOW(), last_contact_channel = 'phone',
              last_contact_outcome = 'left_message', updated_at = NOW() WHERE id = $1`,
      [lead.id]
    );
    return { status: 'executed', result: 'Contact logged.' };
  }

  if (action.action_type === 'send_email') {
    if (!msg.email) return { status: 'skipped', result: 'SMTP not configured — draft approved, not sent.' };
    if (!lead.parent_email) return { status: 'skipped', result: 'No parent email.' };
    const sent = await sendEmail({
      to: lead.parent_email,
      subject: 'Silverleaf Academy — admission follow-up',
      html: `<p>${escapeHtml(draft)}</p>`,
    });
    return sent
      ? { status: 'executed', result: 'Email sent.' }
      : { status: 'skipped', result: 'Email send returned false.' };
  }

  if (action.action_type === 'send_sms') {
    if (!msg.sms) return { status: 'skipped', result: 'Africa’s Talking not configured — draft approved, not sent.' };
    if (!lead.parent_phone) return { status: 'skipped', result: 'No parent phone.' };
    const sent = await sendSMS({ phone: lead.parent_phone, message: draft });
    return sent
      ? { status: 'executed', result: 'SMS sent.' }
      : { status: 'skipped', result: 'SMS send returned false.' };
  }

  if (action.action_type === 'send_whatsapp' || action.action_type === 'send_form_link') {
    const canWa = msg.whatsapp;
    const canSms = msg.sms;
    if (!canWa && !canSms && !msg.email) {
      return { status: 'skipped', result: 'No WhatsApp / SMS / email configured — draft approved, not sent.' };
    }
    let sent = false;
    if (canWa && lead.whatsapp_number) sent = await sendWhatsApp({ phone: lead.whatsapp_number, message: draft, fallbackPhone: lead.parent_phone });
    else if (canSms && lead.parent_phone) sent = await sendSMS({ phone: lead.parent_phone, message: draft });
    else if (msg.email && lead.parent_email) {
      sent = await sendEmail({
        to: lead.parent_email,
        subject: 'Silverleaf Academy — admission follow-up',
        html: `<p>${escapeHtml(draft)}</p>`,
      });
    }
    if (action.action_type === 'send_form_link' && sent) {
      await db.query(
        `INSERT INTO lead_form_reminders (lead_id, started_at, step, stopped, stopped_reason, updated_at)
         VALUES ($1, NOW(), 0, FALSE, NULL, NOW())
         ON CONFLICT (lead_id) DO UPDATE SET
           started_at = NOW(), step = 0, stopped = FALSE, stopped_reason = NULL, updated_at = NOW()`,
        [lead.id]
      );
    }
    return sent
      ? { status: 'executed', result: 'Message sent.' }
      : { status: 'skipped', result: 'No usable channel or provider declined the send.' };
  }

  return { status: 'skipped', result: 'Unhandled action type.' };
}

async function review({ actionId, reviewerId, decision, scope }) {
  const { rows } = await db.query('SELECT * FROM agent_actions WHERE id = $1', [actionId]);
  const action = rows[0];
  if (!action) {
    const err = new Error('Action not found.');
    err.status = 404;
    throw err;
  }
  if (scope && !scope.isGlobal && String(action.campus_id) !== String(scope.campusId)) {
    const err = new Error('Action is outside your campus scope.');
    err.status = 403;
    throw err;
  }
  if (action.status !== 'pending') {
    const err = new Error('This action was already reviewed.');
    err.status = 400;
    throw err;
  }
  if (decision === 'reject') {
    const { rows: updated } = await db.query(
      `UPDATE agent_actions
          SET status = 'rejected', reviewed_by = $2, executed_at = NOW(), result = 'Rejected by staff'
        WHERE id = $1
        RETURNING *`,
      [actionId, reviewerId]
    );
    return updated[0];
  }

  const outcome = await executeAction(action, reviewerId);
  const { rows: updated } = await db.query(
    `UPDATE agent_actions
        SET status = $2, reviewed_by = $3, executed_at = NOW(), result = $4
      WHERE id = $1
      RETURNING *`,
    [actionId, outcome.status, reviewerId, outcome.result]
  );
  return updated[0];
}

module.exports = {
  ALLOWED,
  loadLead,
  buildQueue,
  draftMessage,
  defaultActionType,
  propose,
  review,
  payloadOf,
};
