require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');

const { authRouter }    = require('./middleware/auth');
const { requireWebhookSecret } = require('./middleware/webhookAuth');
const { sendEmail, sendSMS, sendWhatsApp } = require('./middleware/notifications');
const { escapeHtml } = require('./lib/safe');
const { broadcast }      = require('./lib/realtime');
const adminRoutes        = require('./routes/admin');
const marketingRoutes    = require('./routes/marketing');
const publicRoutes       = require('./routes/public');
const seRoutes           = require('./routes/studentExperience');
const dispensaryRoutes   = require('./routes/dispensary');
const feedbackRoutes     = require('./routes/feedback');
const db                 = require('./db');
const readiness          = require('./lib/readiness');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(compression());
app.use(morgan('dev'));

const corsOrigin = process.env.FRONTEND_URL;
const extraOrigins = (process.env.PUBLIC_WEB_ORIGINS || 'https://silverleaf.co.tz,https://www.silverleaf.co.tz')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  corsOrigin,
  ...extraOrigins,
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3180',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3180',
  'http://silverleaf.localhost:3180',
].filter(Boolean));

if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.warn('FRONTEND_URL is not set — CORS will reject unknown browser origins in production.');
}
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Webhook-Secret'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── ROUTES ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'online', timestamp: new Date() }));

app.get('/api/health/live', (req, res) => {
  const snap = readiness.snapshot();
  res.status(snap.live ? 200 : 503).json({
    status: snap.live ? 'ready' : 'not_ready',
    go_live: snap.go_live,
    environment: snap.environment,
    blockers: snap.blockers,
    connections: snap.connections,
    timestamp: new Date(),
  });
});

// Public route — parent inquiry form (creates a lead only; does NOT skip to form_filled).
// (req.url must be rewritten to '/apply' — mounting a Router via app.post(exactPath, ...)
// does not strip/rewrite the path the way app.use(prefix, ...) does, so without this the
// router's internal '/apply' route never matches and every request falls through to
// router.use(authenticateSession), rejecting the public form with "No token provided.")
app.post('/api/apply', (req, res, next) => { req.url = '/apply'; next(); }, marketingRoutes);
app.use('/api/public', publicRoutes);

app.use('/api/auth',        authRouter);
app.use('/api/admin',       adminRoutes);
app.use('/api/marketing',   marketingRoutes);
app.use('/api/se',          seRoutes);
app.use('/api/dispensary',  dispensaryRoutes);
app.use('/api/feedback',    feedbackRoutes);

// Buffer.com — pull Silverleaf channels (BUFFER_API_KEY). Keep /puffer as an alias.
async function ingestBufferWebhook(req, res) {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    for (const item of payload) {
      const { platform, date, followers, reach, impressions, engagement_rate, posts_count, campus_id } = item;
      if (!platform || !date) continue;
      await db.query(
        `INSERT INTO social_analytics (campus_id, platform, date, followers, reach, impressions, engagement_rate, posts_count, source, raw_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'buffer',$9)
         ON CONFLICT (campus_id, platform, date) DO UPDATE SET
           followers=$4, reach=$5, impressions=$6, engagement_rate=$7, posts_count=$8,
           source='buffer', raw_payload=$9`,
        [campus_id || null, platform, date, followers||0, reach||0, impressions||0, engagement_rate||0, posts_count||0, JSON.stringify(item)]
      );
    }
    broadcast('global', 'social-updated', { source: 'buffer' });
    res.json({ success: true });
  } catch (err) {
    console.error('Buffer webhook error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

app.post('/api/webhooks/buffer', requireWebhookSecret('BUFFER_WEBHOOK_SECRET', 'PUFFER_WEBHOOK_SECRET', 'WEBHOOK_SECRET'), ingestBufferWebhook);
app.post('/api/webhooks/puffer', requireWebhookSecret('BUFFER_WEBHOOK_SECRET', 'PUFFER_WEBHOOK_SECRET', 'WEBHOOK_SECRET'), ingestBufferWebhook);

// Ed Admin webhook — fired when the parent submits the online admission
// application (silverleafacademy.ed-space.net/onlineapplication.cfm?ref=<lead_id>).
// Idempotent: a lead only ever gets one admission_applications row from this path.
app.post('/api/webhooks/edadmin/application-submitted', requireWebhookSecret('EDADMIN_WEBHOOK_SECRET', 'WEBHOOK_SECRET'), async (req, res) => {
  try {
    const { lead_id, edadmin_ref } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id is required.' });

    const { rows: existing } = await db.query('SELECT id FROM admission_applications WHERE lead_id = $1', [lead_id]);
    if (existing.length) {
      if (edadmin_ref) await db.query('UPDATE admission_applications SET edadmin_ref = $1 WHERE lead_id = $2', [edadmin_ref, lead_id]);
      return res.json({ success: true, alreadyRecorded: true });
    }

    const { rows: leadRows } = await db.query('SELECT id, campus_id FROM marketing_leads WHERE id = $1', [lead_id]);
    if (!leadRows.length) return res.status(404).json({ error: 'Lead not found.' });
    const lead = leadRows[0];

    // Fires trg_application_stage → moves the lead to 'form_filled' (Register).
    await db.query(
      `INSERT INTO admission_applications (lead_id, campus_id, edadmin_ref, submitted_at)
       VALUES ($1, $2, $3, NOW())`,
      [lead.id, lead.campus_id, edadmin_ref || null]
    );

    const { rows: scoreRows } = await db.query('SELECT compute_lead_score($1) AS score', [lead.id]);
    await db.query('UPDATE marketing_leads SET lead_score = $1 WHERE id = $2', [scoreRows[0].score, lead.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Ed Admin application-submitted error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Ed Admin handoff webhook
// Guarded so it only advances a lead that's exactly at 'form_filled' — if staff already
// used the manual "Mark as Enrolled" fallback, or the lead has since paid/declined/lapsed,
// this just backfills edadmin_ref for reconciliation instead of overwriting the stage.
app.post('/api/webhooks/edadmin/enrolment-confirmed', requireWebhookSecret('EDADMIN_WEBHOOK_SECRET', 'WEBHOOK_SECRET'), async (req, res) => {
  try {
    const { lead_id, edadmin_student_id, enrolment_date } = req.body;
    if (lead_id) {
      if (edadmin_student_id) {
        try {
          await db.query(
            `UPDATE marketing_leads
                SET edadmin_student_id = $1, updated_at = NOW()
              WHERE id = $2`,
            [String(edadmin_student_id), lead_id]
          );
        } catch (err) {
          console.error('Could not store edadmin_student_id (run sql/009):', err.message);
        }
      }
      const { rows } = await db.query('SELECT computed_stage FROM marketing_leads WHERE id = $1', [lead_id]);
      if (rows.length && rows[0].computed_stage === 'form_filled') {
        await db.query(
          `UPDATE marketing_leads SET computed_stage = 'enrolled', updated_at = NOW() WHERE id = $1`,
          [lead_id]
        );
        await db.query(
          `UPDATE admission_applications
             SET edadmin_ref = $1, enrolment_source = 'edadmin', enrolled_at = COALESCE($2::timestamptz, NOW())
           WHERE lead_id = $3`,
          [edadmin_student_id, enrolment_date || null, lead_id]
        );

        const { rows: leadRows } = await db.query(
          'SELECT parent_name, child_name, parent_phone, parent_email, whatsapp_number FROM marketing_leads WHERE id = $1',
          [lead_id]
        );
        const lead = leadRows[0];
        if (lead) {
          const message = `Dear ${lead.parent_name}, congratulations! ${lead.child_name || 'Your child'} has been offered a place at Silverleaf Academy. Please complete the admission payment to secure the place, then send us your payment receipt so our admissions team can confirm it and finalize the enrolment.`;
          if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message, fallbackPhone: lead.parent_phone });
          else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message });
          if (lead.parent_email) {
            sendEmail({ to: lead.parent_email, subject: 'Congratulations — Admission Offer from Silverleaf Academy', html: `<p>${escapeHtml(message)}</p>` });
          }
        }
      } else if (rows.length) {
        await db.query(
          `UPDATE admission_applications SET edadmin_ref = $1 WHERE lead_id = $2`,
          [edadmin_student_id, lead_id]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Ed Admin enrolment-confirmed error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Ed Admin finance webhook — fired when Ed Admin's finance module marks the
// admission payment as received. Coexists with the manual "Record Payment"
// action in the UI (marketing.js POST /payments); whichever fires first wins,
// the other is a no-op via the idempotency check below.
app.post('/api/webhooks/edadmin/payment-confirmed', requireWebhookSecret('EDADMIN_WEBHOOK_SECRET', 'WEBHOOK_SECRET'), async (req, res) => {
  try {
    const { lead_id, amount, currency, payment_method, reference_number, paid_at, edadmin_ref } = req.body;
    if (!lead_id || amount === undefined || amount === null)
      return res.status(400).json({ error: 'lead_id and amount are required.' });

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0)
      return res.status(400).json({ error: 'amount must be a positive number.' });

    const { rows: existingPay } = await db.query('SELECT id FROM admission_payments WHERE lead_id = $1', [lead_id]);
    if (existingPay.length) return res.json({ success: true, alreadyRecorded: true });

    const { rows: leadRows } = await db.query(
      'SELECT campus_id, campaign_id, parent_name, parent_phone, parent_email, whatsapp_number, child_name FROM marketing_leads WHERE id = $1',
      [lead_id]
    );
    if (!leadRows.length) return res.status(404).json({ error: 'Lead not found.' });
    const lead = leadRows[0];

    // Fires trg_payment_stage → moves the lead to 'admission_paid'.
    await db.query(
      `INSERT INTO admission_payments (lead_id, campus_id, amount, currency, payment_method, reference_number, paid_at, notes, edadmin_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [lead_id, lead.campus_id, numericAmount, currency || 'TZS', payment_method || 'edadmin', reference_number || null,
       paid_at || new Date(), 'Recorded automatically via Ed Admin finance confirmation.', edadmin_ref || null]
    );

    const { rows: scoreRows } = await db.query('SELECT compute_lead_score($1) AS score', [lead_id]);
    await db.query('UPDATE marketing_leads SET lead_score = $1 WHERE id = $2', [scoreRows[0].score, lead_id]);
    if (lead.campaign_id) {
      await db.query('UPDATE marketing_campaigns SET conversions = conversions + 1 WHERE id = $1', [lead.campaign_id]);
    }

    const receiptMsg = `Dear ${lead.parent_name}, we've received your admission payment of ${currency || 'TZS'} ${numericAmount} for ${lead.child_name || 'your child'}${reference_number ? ` (ref: ${reference_number})` : ''}. Welcome to the Silverleaf Academy family! Our admissions team will be in touch with onboarding details.`;
    if (lead.whatsapp_number) sendWhatsApp({ phone: lead.whatsapp_number, message: receiptMsg, fallbackPhone: lead.parent_phone });
    else if (lead.parent_phone) sendSMS({ phone: lead.parent_phone, message: receiptMsg });
    if (lead.parent_email) {
      sendEmail({ to: lead.parent_email, subject: 'Payment Received — Welcome to Silverleaf Academy', html: `<p>${escapeHtml(receiptMsg)}</p>` });
    }

    broadcast(lead.campus_id ? `campus-${lead.campus_id}` : 'global', 'admission_paid', { leadId: lead_id, amount: numericAmount, campusId: lead.campus_id });

    res.json({ success: true });
  } catch (err) {
    console.error('Ed Admin payment-confirmed error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.all('/api/cron/edadmin-sync', require('./api/cron/edadmin-sync'));
app.all('/api/cron/buffer-sync', require('./api/cron/buffer-sync'));

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
