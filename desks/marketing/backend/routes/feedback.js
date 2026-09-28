const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateSession, requirePasswordChanged } = require('../middleware/auth');
const { sendServerError } = require('../lib/safe');

router.use(authenticateSession);
router.use(requirePasswordChanged);

const GLOBAL_REVIEW_ROLES = ['ceo', 'global_marketing_head', 'global_student_exp_head'];
const CAMPUS_REVIEW_ROLES = ['campus_marketing_head', 'campus_student_exp_head'];
const CATEGORIES = new Set(['bug', 'idea', 'question', 'general']);
const STATUSES = new Set(['open', 'reviewed', 'in_progress', 'done']);
const OPEN_STATUSES = ['open', 'reviewed', 'in_progress'];

function userRoles(req) {
  return [req.user?.role, ...(req.user?.additionalRoles || [])].filter(Boolean);
}

function canReviewAll(req) {
  return userRoles(req).some((r) => GLOBAL_REVIEW_ROLES.includes(r));
}

function canReviewCampus(req) {
  return Boolean(req.user?.campusId) && userRoles(req).some((r) => CAMPUS_REVIEW_ROLES.includes(r));
}

function canReview(req) {
  return canReviewAll(req) || canReviewCampus(req);
}

function normalizeStatus(value) {
  const status = String(value || '').trim();
  if (status === 'reviewed') return 'in_progress';
  return STATUSES.has(status) ? status : '';
}

let tableReady = false;
async function ensureFeedbackTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module      VARCHAR(40),
      page_path   VARCHAR(300),
      category    VARCHAR(40) NOT NULL DEFAULT 'general'
                    CHECK (category IN ('bug', 'idea', 'question', 'general')),
      message     TEXT NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'open',
      admin_note  TEXT,
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await db.query(`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE user_feedback DROP CONSTRAINT IF EXISTS user_feedback_status_check`);
  await db.query(`
    ALTER TABLE user_feedback
      ADD CONSTRAINT user_feedback_status_check
      CHECK (status IN ('open', 'reviewed', 'in_progress', 'done'))
  `);
  await db.query(`UPDATE user_feedback SET status = 'in_progress' WHERE status = 'reviewed'`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback(user_id, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_module ON user_feedback(module, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback(category, created_at DESC)`);
  tableReady = true;
}

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function listSelectSql() {
  return `SELECT f.id, f.user_id, f.module, f.page_path, f.category, f.message,
              CASE WHEN f.status = 'reviewed' THEN 'in_progress' ELSE f.status END AS status,
              f.admin_note, f.resolved_by, f.resolved_at, f.created_at, f.updated_at,
              u.name AS user_name, u.email AS user_email, u.role AS user_role,
              c.name AS campus_name,
              ru.name AS resolved_by_name
       FROM user_feedback f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN campuses c ON u.campus_id = c.id
       LEFT JOIN users ru ON ru.id = f.resolved_by`;
}

router.get('/', async (req, res) => {
  try {
    await ensureFeedbackTable();
    const wantAll = String(req.query.scope || '') !== 'mine' && canReview(req);
    const status = normalizeStatus(req.query.status);
    const category = CATEGORIES.has(req.query.category) ? req.query.category : '';
    const moduleName = clip(req.query.module, 40);
    const q = clip(req.query.q, 120);
    const conds = [];
    const params = [];

    if (!wantAll) {
      params.push(req.user.id);
      conds.push(`f.user_id = $${params.length}`);
    } else if (!canReviewAll(req) && canReviewCampus(req)) {
      params.push(req.user.campusId);
      conds.push(`u.campus_id = $${params.length}`);
    }
    if (status) {
      if (status === 'in_progress') {
        conds.push(`f.status IN ('in_progress', 'reviewed')`);
      } else {
        params.push(status);
        conds.push(`f.status = $${params.length}`);
      }
    }
    if (category) {
      params.push(category);
      conds.push(`f.category = $${params.length}`);
    }
    if (moduleName) {
      params.push(moduleName);
      conds.push(`f.module = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      conds.push(`(f.message ILIKE ${p} OR u.name ILIKE ${p} OR COALESCE(f.page_path, '') ILIKE ${p} OR COALESCE(c.name, '') ILIKE ${p})`);
    }

    const { rows } = await db.query(
      `${listSelectSql()}
       ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
       ORDER BY f.created_at DESC
       LIMIT 200`,
      params
    );
    res.json({
      data: rows,
      can_review: canReview(req),
      can_review_all: canReviewAll(req),
    });
  } catch (err) {
    return sendServerError(res, err, 'List feedback');
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureFeedbackTable();
    const message = clip(req.body?.message, 2000);
    const category = CATEGORIES.has(req.body?.category) ? req.body.category : 'general';
    const moduleName = clip(req.body?.module, 40);
    const pagePath = clip(req.body?.page_path, 300);
    if (message.length < 4) {
      return res.status(400).json({ error: 'Please write a short note (at least a few words).' });
    }

    const inserted = await db.query(
      `INSERT INTO user_feedback (user_id, module, page_path, category, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.user.id, moduleName || null, pagePath || null, category, message]
    );
    const { rows } = await db.query(`${listSelectSql()} WHERE f.id = $1`, [inserted.rows[0].id]);
    res.json({ success: true, item: rows[0] });
  } catch (err) {
    return sendServerError(res, err, 'Create feedback');
  }
});

router.patch('/', async (req, res) => {
  if (!canReviewAll(req)) return res.status(403).json({ error: 'Insufficient permissions.' });
  try {
    await ensureFeedbackTable();
    const status = normalizeStatus(req.body?.status);
    const scope = String(req.body?.scope || '');
    if (status !== 'done' || scope !== 'open') {
      return res.status(400).json({ error: 'Use status=done and scope=open to close open notes.' });
    }
    const { rows } = await db.query(
      `UPDATE user_feedback
          SET status = 'done',
              resolved_by = $1,
              resolved_at = NOW(),
              updated_at = NOW()
        WHERE status = ANY($2::varchar[])
        RETURNING id`,
      [req.user.id, OPEN_STATUSES]
    );
    const list = rows.length
      ? (await db.query(`${listSelectSql()} WHERE f.id = ANY($1::int[])`, [rows.map((r) => r.id)])).rows
      : [];
    res.json({ success: true, data: list });
  } catch (err) {
    return sendServerError(res, err, 'Close open feedback');
  }
});

router.patch('/:id', async (req, res) => {
  if (!canReview(req)) return res.status(403).json({ error: 'Insufficient permissions.' });
  try {
    await ensureFeedbackTable();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid feedback id.' });

    const existing = await db.query(
      `SELECT f.id, u.campus_id
         FROM user_feedback f
         JOIN users u ON u.id = f.user_id
        WHERE f.id = $1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Feedback not found.' });
    if (!canReviewAll(req) && Number(existing.rows[0].campus_id) !== Number(req.user.campusId)) {
      return res.status(403).json({ error: 'Feedback is outside your campus.' });
    }

    const sets = [];
    const params = [];
    const status = normalizeStatus(req.body?.status);
    if (status) {
      params.push(status);
      sets.push(`status = $${params.length}`);
      if (status === 'done') {
        params.push(req.user.id);
        sets.push(`resolved_by = $${params.length}`);
        sets.push('resolved_at = NOW()');
      } else {
        sets.push('resolved_by = NULL');
        sets.push('resolved_at = NULL');
      }
    }
    if (req.body?.admin_note !== undefined) {
      params.push(clip(req.body.admin_note, 1000) || null);
      sets.push(`admin_note = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });

    params.push(id);
    const updated = await db.query(
      `UPDATE user_feedback
          SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING id`,
      params
    );
    if (!updated.rows.length) return res.status(404).json({ error: 'Feedback not found.' });
    const { rows } = await db.query(`${listSelectSql()} WHERE f.id = $1`, [id]);
    res.json({ success: true, item: rows[0] });
  } catch (err) {
    return sendServerError(res, err, 'Update feedback');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureFeedbackTable();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid feedback id.' });

    const { rows } = await db.query(
      `SELECT f.id, f.user_id, u.campus_id
         FROM user_feedback f
         JOIN users u ON u.id = f.user_id
        WHERE f.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Feedback not found.' });
    const own = rows[0].user_id === req.user.id;
    const campusOk = canReviewCampus(req) && Number(rows[0].campus_id) === Number(req.user.campusId);
    if (!own && !canReviewAll(req) && !campusOk) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    await db.query('DELETE FROM user_feedback WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err, 'Delete feedback');
  }
});

module.exports = router;
