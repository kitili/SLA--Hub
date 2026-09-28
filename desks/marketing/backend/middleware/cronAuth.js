/**
 * Fail-closed cron auth. Rejects when CRON_SECRET is unset/empty.
 */
function assertCronAuthorized(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Cron endpoint is not configured.' });
    return false;
  }
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized.' });
    return false;
  }
  return true;
}

module.exports = { assertCronAuthorized };
