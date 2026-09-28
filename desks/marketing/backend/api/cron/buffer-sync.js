// Nightly: pull Silverleaf Buffer.com channels + post metrics into social_analytics.
const db = require('../../db');
const buffer = require('../../lib/buffer');
const { assertCronAuthorized } = require('../../middleware/cronAuth');
const { broadcast } = require('../../lib/realtime');

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;
  try {
    const result = await buffer.syncAnalytics(db);
    if (!result.skipped) {
      broadcast('global', 'social-updated', { source: 'buffer' });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('buffer-sync cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
