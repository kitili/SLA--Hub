const crypto = require('crypto');

/**
 * Require a shared webhook secret via Authorization: Bearer <secret>
 * or X-Webhook-Secret: <secret>.
 *
 * Checks env vars in order; fails closed when none are configured.
 */
function requireWebhookSecret(...envVarNames) {
  const names = envVarNames.length ? envVarNames : ['WEBHOOK_SECRET'];
  return (req, res, next) => {
    const expectedName = names.find((n) => process.env[n]);
    const expected = expectedName ? process.env[expectedName] : null;
    if (!expected) {
      console.error(`Webhook rejected: none of [${names.join(', ')}] configured.`);
      return res.status(503).json({ error: 'Webhook endpoint is not configured.' });
    }

    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const provided = bearer || req.headers['x-webhook-secret'] || '';

    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    next();
  };
}

module.exports = { requireWebhookSecret };
