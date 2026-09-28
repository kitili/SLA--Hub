// Vercel Cron target — was previously an in-process node-cron job in server.js.
// Daily: admission-form reminder sequence (day 3, day 7 after the initial nudge)
const db = require('../../db');
const { assertCronAuthorized } = require('../../middleware/cronAuth');
const { sendSMS, sendEmail, sendWhatsApp } = require('../../middleware/notifications');
const { escapeHtml } = require('../../lib/safe');

const FORM_REMINDER_OFFSETS_DAYS = [3, 7];
const FORM_REMINDER_STOP_STAGES  = ['form_filled', 'enrolled', 'admission_paid', 'declined', 'lapsed', 'dead_lead'];
const EDADMIN_APPLICATION_URL = 'https://silverleafacademy.ed-space.net/onlineapplication.cfm';

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;

  try {
    const { rows } = await db.query(`
      SELECT r.id, r.lead_id, r.step, r.started_at,
             l.parent_name, l.child_name, l.parent_phone, l.parent_email,
             l.whatsapp_number, l.computed_stage
      FROM lead_form_reminders r
      JOIN marketing_leads l ON l.id = r.lead_id
      WHERE r.stopped = FALSE
    `);

    let sent = 0;
    for (const r of rows) {
      if (FORM_REMINDER_STOP_STAGES.includes(r.computed_stage)) {
        await db.query('UPDATE lead_form_reminders SET stopped = TRUE, stopped_reason = $1, updated_at = NOW() WHERE id = $2', [r.computed_stage, r.id]);
        continue;
      }
      if (r.step >= FORM_REMINDER_OFFSETS_DAYS.length) {
        await db.query('UPDATE lead_form_reminders SET stopped = TRUE, stopped_reason = $1, updated_at = NOW() WHERE id = $2', ['max_reminders', r.id]);
        continue;
      }

      const dueAt = new Date(new Date(r.started_at).getTime() + FORM_REMINDER_OFFSETS_DAYS[r.step] * 86400000);
      if (dueAt > new Date()) continue;

      const link = `${EDADMIN_APPLICATION_URL}?ref=${r.lead_id}`;
      const message = `Dear ${r.parent_name}, a friendly reminder to complete ${r.child_name || 'your child'}'s admission form for Silverleaf Academy so we can secure their place: ${link} — reply here or call our admissions office if you need any help. Thank you!`;

      if (r.whatsapp_number) sendWhatsApp({ phone: r.whatsapp_number, message, fallbackPhone: r.parent_phone });
      else if (r.parent_phone) sendSMS({ phone: r.parent_phone, message });
      if (r.parent_email) {
        sendEmail({
          to: r.parent_email,
          subject: 'Reminder — Complete Your Admission Form',
          html: `<p>Dear ${escapeHtml(r.parent_name)}, a friendly reminder to complete ${escapeHtml(r.child_name || 'your child')}'s admission form for Silverleaf Academy.</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
        });
      }

      await db.query('UPDATE lead_form_reminders SET step = step + 1, updated_at = NOW() WHERE id = $1', [r.id]);
      sent++;
    }
    res.json({ success: true, remindersSent: sent, sequencesChecked: rows.length });
  } catch (err) {
    console.error('form-reminders cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
