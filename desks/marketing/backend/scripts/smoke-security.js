/**
 * Lightweight security smoke tests (no DB required).
 * Run: npm run test:security
 */
const assert = require('assert');
const { requireWebhookSecret } = require('../middleware/webhookAuth');
const { assertCronAuthorized } = require('../middleware/cronAuth');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars-long!!';
process.env.DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'TestDefault@2026';

const {
  sanitizeAdditionalRoles,
  validateSilverleafEmail,
  requirePasswordChanged,
} = require('../middleware/auth');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('Security smoke tests\n');

check('validateSilverleafEmail accepts exact domain', () => {
  assert.strictEqual(validateSilverleafEmail('eric@silverleaf.co.tz'), true);
});

check('validateSilverleafEmail rejects spoofed domain suffix', () => {
  assert.strictEqual(validateSilverleafEmail('evil@notsilverleaf.co.tz'), false);
  assert.strictEqual(validateSilverleafEmail('evil@silverleaf.co.tz.evil.com'), false);
});

check('sanitizeAdditionalRoles blocks privilege escalation', () => {
  const roles = sanitizeAdditionalRoles(
    'global_marketing_head',
    'campus_marketing_head',
    ['global_student_exp_head', 'nurse', 'campus_marketing_head', 'campus_marketing_head']
  );
  assert.deepStrictEqual(roles, []);
});

check('sanitizeAdditionalRoles allows managed same-dept extras', () => {
  const roles = sanitizeAdditionalRoles(
    'global_student_exp_head',
    'campus_student_exp_head',
    ['nurse', 'global_marketing_head']
  );
  assert.deepStrictEqual(roles, ['nurse']);
});

check('webhook auth fails closed when secret unset', () => {
  delete process.env.WEBHOOK_SECRET;
  delete process.env.BUFFER_WEBHOOK_SECRET;
  delete process.env.PUFFER_WEBHOOK_SECRET;
  const mw = requireWebhookSecret('BUFFER_WEBHOOK_SECRET', 'PUFFER_WEBHOOK_SECRET', 'WEBHOOK_SECRET');
  let status;
  mw({ headers: {} }, { status: (s) => ({ json: () => { status = s; } }) }, () => {});
  assert.strictEqual(status, 503);
});

check('webhook auth rejects bad secret', () => {
  process.env.WEBHOOK_SECRET = 'correct-secret';
  const mw = requireWebhookSecret('WEBHOOK_SECRET');
  let status;
  mw(
    { headers: { authorization: 'Bearer wrong-secret' } },
    { status: (s) => ({ json: () => { status = s; } }) },
    () => { status = 200; }
  );
  assert.strictEqual(status, 401);
});

check('webhook auth accepts matching Bearer secret', () => {
  process.env.WEBHOOK_SECRET = 'correct-secret';
  const mw = requireWebhookSecret('WEBHOOK_SECRET');
  let calledNext = false;
  mw(
    { headers: { authorization: 'Bearer correct-secret' } },
    { status: () => ({ json: () => {} }) },
    () => { calledNext = true; }
  );
  assert.strictEqual(calledNext, true);
});

check('cron auth fails closed when CRON_SECRET unset', () => {
  delete process.env.CRON_SECRET;
  let status;
  const ok = assertCronAuthorized(
    { headers: { authorization: 'Bearer undefined' } },
    { status: (s) => ({ json: () => { status = s; } }) }
  );
  assert.strictEqual(ok, false);
  assert.strictEqual(status, 503);
});

check('requirePasswordChanged blocks flagged JWTs', () => {
  let status;
  requirePasswordChanged(
    { user: { mustChangePassword: true } },
    { status: (s) => ({ json: (body) => { status = { s, body }; } }) },
    () => { status = { s: 200 }; }
  );
  assert.strictEqual(status.s, 403);
  assert.strictEqual(status.body.code, 'MUST_CHANGE_PASSWORD');
});

const { escapeHtml, assertCampusAccess } = require('../lib/safe');

check('escapeHtml escapes markup', () => {
  assert.strictEqual(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
});

check('assertCampusAccess allows global and matching campus', () => {
  assert.strictEqual(assertCampusAccess({ isGlobal: true, campusId: null }, 9), true);
  assert.strictEqual(assertCampusAccess({ isGlobal: false, campusId: 3 }, 3), true);
  assert.strictEqual(assertCampusAccess({ isGlobal: false, campusId: 3 }, 9), false);
});

const sessionCookie = require('../lib/sessionCookie');
const { looksPlaceholder, messaging } = require('../lib/readiness');
const edadmin = require('../lib/edadmin');
const { draftMessage, defaultActionType, payloadOf } = require('../lib/agentLoop');

check('placeholder secrets are treated as missing', () => {
  assert.strictEqual(looksPlaceholder(''), true);
  assert.strictEqual(looksPlaceholder('<General API key from Ed Admin>'), true);
  assert.strictEqual(looksPlaceholder('local-webhook-secret-dev-only'), true);
  assert.strictEqual(looksPlaceholder('a-real-looking-secret-value'), false);
});

check('Ed Admin phone + XML helpers do not persist records', () => {
  assert.ok(edadmin.phonesOverlap('+255784689585', '0784689585'));
  const rows = edadmin.parseXmlRecords('<root><Parents><ID>9</ID><MPCell>0712</MPCell></Parents></root>', 'Parents');
  assert.strictEqual(rows[0].ID, '9');
  assert.strictEqual(edadmin.isConfigured(), false);
});

check('agent drafts a message and never auto-sends', () => {
  const lead = {
    id: 12,
    parent_name: 'Demo parent',
    child_name: 'Child A',
    parent_phone: '0712345678',
    vitality: { status: 'cold', next: 'Call and book a campus tour.' },
  };
  const draft = draftMessage(lead, 'send_whatsapp');
  assert.ok(draft.includes('Demo parent'));
  assert.ok(draft.includes('Call and book a campus tour'));
  assert.strictEqual(defaultActionType(lead), 'send_whatsapp');
  assert.strictEqual(payloadOf({ payload: { draft } }).draft, draft);
});

check('session cookie is HMAC-signed and expires', () => {
  const raw = sessionCookie.encodeSession(sessionCookie.buildSessionPayload(42));
  const parsed = sessionCookie.decodeSession(raw);
  assert.strictEqual(parsed.userId, 42);
  assert.ok(parsed.exp > Date.now());
  assert.strictEqual(sessionCookie.decodeSession('tampered.' + raw.split('.')[1]), null);
  assert.ok(sessionCookie.getSessionCookieName().includes('sla_mse_session'));
});

check('messaging() is off when SMTP/AT are empty', () => {
  const prev = { SMTP_USER: process.env.SMTP_USER, SMTP_PASS: process.env.SMTP_PASS, AT_API_KEY: process.env.AT_API_KEY, AT_USERNAME: process.env.AT_USERNAME };
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  process.env.AT_API_KEY = '';
  process.env.AT_USERNAME = '';
  const msg = messaging();
  assert.strictEqual(msg.email, false);
  assert.strictEqual(msg.sms, false);
  Object.assign(process.env, prev);
});

console.log(`\n${passed} checks passed`);
if (process.exitCode) process.exit(1);
