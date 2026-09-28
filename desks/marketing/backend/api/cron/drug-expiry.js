// Vercel Cron target — was previously an in-process node-cron job in server.js.
// Nightly: expiry alerts — flag drugs expiring within 30 days
const db = require('../../db');
const { assertCronAuthorized } = require('../../middleware/cronAuth');
const { sendEmail } = require('../../middleware/notifications');
const { escapeHtml } = require('../../lib/safe');

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;

  try {
    const { rows } = await db.query(`
      SELECT di.id, di.drug_name, di.expiry_date, di.campus_id, c.name AS campus_name
      FROM drug_inventory di JOIN campuses c ON di.campus_id = c.id
      WHERE di.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND di.expiry_date > CURRENT_DATE AND di.quantity > 0
    `);
    let notified = 0;
    for (const drug of rows) {
      const nurses = (await db.query(
        `SELECT email, name FROM users WHERE role = 'nurse' AND campus_id = $1 AND is_active = TRUE`,
        [drug.campus_id]
      )).rows;
      for (const nurse of nurses) {
        const ok = await sendEmail({
          to: nurse.email,
          subject: `Drug expiry alert — ${drug.drug_name} (${drug.campus_name})`,
          html: `<p>Dear ${escapeHtml(nurse.name)},</p><p><strong>${escapeHtml(drug.drug_name)}</strong> at ${escapeHtml(drug.campus_name)} expires on <strong>${escapeHtml(drug.expiry_date)}</strong>. Please review inventory and reorder if needed.</p>`,
        });
        if (ok) notified++;
        else console.log(`⚠️  Expiry alert (email not sent): ${drug.drug_name} → ${nurse.email}`);
      }
    }
    res.json({ success: true, drugsExpiring: rows.length, notificationsSent: notified });
  } catch (err) {
    console.error('drug-expiry cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
