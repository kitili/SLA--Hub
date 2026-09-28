// Vercel Cron target — was previously an in-process node-cron job in server.js.
// Nightly: auto-create follow-up tasks for stale leads (> 7 days no movement)
const db = require('../../db');
const { assertCronAuthorized } = require('../../middleware/cronAuth');

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;

  try {
    const { rows: staleLeads } = await db.query(`
      SELECT l.id, l.assigned_to, l.computed_stage
      FROM marketing_leads l
      WHERE l.is_archived = FALSE
        AND l.computed_stage NOT IN ('admission_paid','declined','lapsed','enrolled','dead_lead')
        AND COALESCE(l.last_contacted_at, l.created_at, l.updated_at) < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM follow_up_tasks ft
          WHERE ft.lead_id = l.id AND ft.status = 'pending' AND ft.due_date >= CURRENT_DATE
        )
    `);
    for (const lead of staleLeads) {
      await db.query(
        `INSERT INTO follow_up_tasks (lead_id, assigned_to, due_date, notes, auto_created)
         VALUES ($1, $2, CURRENT_DATE + 2, 'Auto-generated: lead has not progressed in 7+ days.', TRUE)`,
        [lead.id, lead.assigned_to]
      );
    }
    res.json({ success: true, tasksCreated: staleLeads.length });
  } catch (err) {
    console.error('stale-leads cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
