// Nightly: mark leads dead from scrapable inactivity — not a staff tag.
// Matches the workbook "Dead Lead" bucket: no movement after follow-ups.
// Sticky — update_lead_stage() will not clobber dead_lead.
const db = require('../../db');
const { assertCronAuthorized } = require('../../middleware/cronAuth');

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;

  try {
    const { rows } = await db.query(`
      UPDATE marketing_leads l
      SET computed_stage = 'dead_lead',
          updated_at = NOW(),
          decline_reason = COALESCE(NULLIF(l.decline_reason, ''), 'Auto: inactivity matches dead-lead rules')
      WHERE l.is_archived = FALSE
        AND l.computed_stage = 'interested_lead'
        AND NOT EXISTS (
          SELECT 1 FROM admission_applications a WHERE a.lead_id = l.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM interview_bookings ib
          WHERE ib.lead_id = l.id AND ib.outcome = 'passed'
        )
        AND (
          COALESCE(l.last_contacted_at, l.created_at, l.updated_at) < NOW() - INTERVAL '90 days'
          OR (
            COALESCE(l.last_contacted_at, l.created_at, l.updated_at) < NOW() - INTERVAL '45 days'
            AND NOT EXISTS (SELECT 1 FROM tour_bookings t WHERE t.lead_id = l.id)
            AND (
              SELECT COUNT(*) FROM follow_up_tasks ft
              WHERE ft.lead_id = l.id AND ft.status IN ('done', 'pending')
            ) >= 2
          )
          OR (
            EXISTS (
              SELECT 1 FROM lead_form_reminders r
              WHERE r.lead_id = l.id
                AND r.step >= 2
                AND r.updated_at < NOW() - INTERVAL '21 days'
            )
          )
          OR (
            (
              SELECT COUNT(*) FROM tour_bookings t
              WHERE t.lead_id = l.id AND t.status = 'no_show'
            ) >= 2
            AND COALESCE(l.last_contacted_at, l.created_at, l.updated_at) < NOW() - INTERVAL '30 days'
          )
        )
      RETURNING id
    `);
    res.json({ success: true, markedDead: rows.length });
  } catch (err) {
    console.error('dead-leads cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
