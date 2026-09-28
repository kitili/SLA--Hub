// Pull Ed Admin Parents + Students (GET-only) into edadmin_* tables.
const db = require('../../db');
const edadmin = require('../../lib/edadmin');
const { assertCronAuthorized } = require('../../middleware/cronAuth');

module.exports = async (req, res) => {
  if (!assertCronAuthorized(req, res)) return;
  try {
    const result = await edadmin.syncDirectory(db);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('edadmin-sync cron error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
