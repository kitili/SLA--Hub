const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const sessionCookie = require('../lib/sessionCookie');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required.');
if (!process.env.DEFAULT_PASSWORD) throw new Error('DEFAULT_PASSWORD environment variable is required.');

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
const MARKETING_LOGIN_EMAIL = 'marketing@silverleaf.co.tz';
const CEO_LOGIN_EMAIL = 'ceo@silverleaf.co.tz';
const ADMIN_LOGIN_EMAIL = 'admin@silverleaf.co.tz';
const DOMAIN = '@silverleaf.co.tz';

function normalizeLoginEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  if (normalized === ADMIN_LOGIN_EMAIL) return CEO_LOGIN_EMAIL;
  return normalized;
}

function isPinnedMarketingLogin(email) {
  return String(email || '').toLowerCase() === MARKETING_LOGIN_EMAIL;
}

function isPinnedLeadershipLogin(email) {
  const normalized = String(email || '').toLowerCase();
  return normalized === CEO_LOGIN_EMAIL || normalized === ADMIN_LOGIN_EMAIL || isPinnedMarketingLogin(normalized);
}

function isProtectedAccount(email) {
  const normalized = String(email || '').toLowerCase();
  return normalized === MARKETING_LOGIN_EMAIL || normalized === CEO_LOGIN_EMAIL || normalized === ADMIN_LOGIN_EMAIL;
}
// bcryptjs (pure JS, required for Vercel's serverless runtime) is much slower than
// native bcrypt per cost increment — 10 keeps hashing solidly secure while cutting
// login latency roughly 4x versus 12. Existing hashes keep verifying regardless of
// which cost created them, since bcrypt embeds it in the hash string itself.
const BCRYPT_COST = 10;

// Roles each global department head is allowed to create/edit/reset.
// global_student_exp_head covers both Student Experience and Dispensary staff.
const MANAGED_ROLES = {
  ceo:                     ['campus_marketing_head'],
  global_marketing_head:   ['campus_marketing_head'],
  global_student_exp_head: ['campus_student_exp_head', 'nurse'],
};

const TEAM_ADMIN_ROLES = ['ceo', 'global_marketing_head'];

const ALL_ROLES = [
  'ceo',
  'global_marketing_head',
  'campus_marketing_head',
  'global_student_exp_head',
  'campus_student_exp_head',
  'nurse',
];

/** Only roles the acting head is allowed to manage; never elevate past that. */
function sanitizeAdditionalRoles(actorRole, primaryRole, additionalRoles) {
  if (!Array.isArray(additionalRoles)) return [];
  const allowed = new Set(MANAGED_ROLES[actorRole] || []);
  return [...new Set(
    additionalRoles
      .filter((r) => typeof r === 'string' && r && r !== primaryRole)
      .filter((r) => allowed.has(r) && ALL_ROLES.includes(r))
  )];
}

// ── Domain validator ────────────────────────────────────────
function validateSilverleafEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return false;
  return normalized.slice(at) === DOMAIN;
}

// ── JWT middleware ───────────────────────────────────────────
function attachUser(req, user) {
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    additionalRoles: user.additional_roles || user.additionalRoles || [],
    campusId: user.campus_id ?? user.campusId ?? null,
    campusName: user.campus_name ?? user.campusName ?? null,
    department: user.department,
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
    mustChangePassword: !!(user.must_change_password ?? user.mustChangePassword),
  };
  req.scope = {
    isGlobal: !req.user.campusId,
    campusId: req.user.campusId || null,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    additionalRoles: user.additional_roles || user.additionalRoles || [],
    campusId: user.campus_id ?? user.campusId ?? null,
    campusName: user.campus_name ?? user.campusName ?? null,
    department: user.department,
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
    mustChangePassword: !!(user.must_change_password ?? user.mustChangePassword),
  };
}

async function loadActiveUser(userId) {
  const { rows } = await db.query(
    `SELECT u.*, c.name AS campus_name
     FROM users u LEFT JOIN campuses c ON u.campus_id = c.id
     WHERE u.id = $1 AND u.is_active = TRUE`,
    [userId]
  );
  return rows[0] || null;
}

async function authenticateSession(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      attachUser(req, decoded);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token invalid or expired.' });
    }
  }

  const session = sessionCookie.readSession(req);
  if (!session) return res.status(401).json({ error: 'No token provided.' });

  try {
    const user = await loadActiveUser(session.userId);
    if (!user) return res.status(401).json({ error: 'Token invalid or expired.' });
    attachUser(req, user);
    sessionCookie.slideSessionIfNeeded(req, res, session);
    return next();
  } catch (err) {
    console.error('Session lookup failed:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/** Block all authenticated routes until the temporary password is changed. */
function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      error: 'Password change required.',
      code: 'MUST_CHANGE_PASSWORD',
    });
  }
  next();
}

// ── Role guard factory ──────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
    const userRoles = [req.user.role, ...(req.user.additionalRoles || [])];
    if (roles.some(r => userRoles.includes(r))) return next();
    return res.status(403).json({ error: 'Insufficient permissions.' });
  };
}

// ── Auth router ─────────────────────────────────────────────
const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  if (!validateSilverleafEmail(email))
    return res.status(400).json({ error: `Only @silverleaf.co.tz email addresses are permitted.` });

  try {
    const result = await db.query(
      `SELECT u.*, c.name AS campus_name
       FROM users u LEFT JOIN campuses c ON u.campus_id = c.id
       WHERE LOWER(u.email) = LOWER($1) AND u.is_active = TRUE`,
      [normalizeLoginEmail(email)]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const portal = String(req.body.portal || '').toLowerCase();
    if (portal === 'ceo' && user.role !== 'ceo') {
      return res.status(403).json({ error: 'This page is for the CEO. Use the staff portal.' });
    }
    if (portal === 'staff' && user.role === 'ceo') {
      return res.status(403).json({ error: 'This page is for staff. Use the CEO portal.' });
    }

    if (isPinnedLeadershipLogin(user.email) && user.must_change_password) {
      await db.query('UPDATE users SET must_change_password = FALSE WHERE id = $1', [user.id]);
      user.must_change_password = false;
    }

    // Not on the response's critical path — last_login is an audit field, not
    // something the client needs before proceeding. Fire-and-forget instead of
    // adding a full extra DB round trip to every login.
    db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])
      .catch(err => console.error('last_login update failed:', err.message));

    const token = jwt.sign(
      {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        role:               user.role,
        additionalRoles:    user.additional_roles || [],
        campusId:           user.campus_id,
        campusName:         user.campus_name,
        department:         user.department,
        mustChangePassword: !!user.must_change_password,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    sessionCookie.setSessionCookie(res, user.id);

    res.json({
      token,
      mustChangePassword: !!user.must_change_password,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Change own password (allowed even when mustChangePassword is true)
authRouter.patch('/change-password', authenticateSession, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  try {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    if (isPinnedMarketingLogin(req.user.email)) {
      return res.status(403).json({ error: 'The marketing@silverleaf.co.tz password is pinned and cannot be changed.' });
    }
    const hash = await bcrypt.hash(new_password, BCRYPT_COST);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
      [hash, req.user.id]
    );
    sessionCookie.setSessionCookie(res, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

authRouter.get('/me', authenticateSession, async (req, res) => {
  try {
    const user = await loadActiveUser(req.user.id);
    if (!user) return res.status(401).json({ error: 'Token invalid or expired.' });
    res.json({
      user: publicUser(user),
      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) {
    console.error('Session me error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

authRouter.post('/logout', (req, res) => {
  sessionCookie.clearSessionCookie(res);
  res.json({ success: true });
});

// Change own email
authRouter.patch('/change-email', authenticateSession, requirePasswordChanged, async (req, res) => {
  const { new_email, password } = req.body;
  if (!validateSilverleafEmail(new_email))
    return res.status(400).json({ error: `Email must end with ${DOMAIN}` });

  try {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Password incorrect.' });

    await db.query(
      'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
      [new_email.toLowerCase(), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    console.error('Change email error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin: reset a user in their own department to default password
authRouter.patch('/reset-password/:userId',
  authenticateSession,
  requireRole('ceo', 'global_marketing_head', 'global_student_exp_head'),
  async (req, res) => {
    try {
      const { rows: targetRows } = await db.query('SELECT id, role, email FROM users WHERE id = $1', [req.params.userId]);
      if (!targetRows.length) return res.status(404).json({ error: 'User not found.' });
      if (isPinnedMarketingLogin(targetRows[0].email)) {
        return res.status(403).json({ error: 'The marketing@silverleaf.co.tz password is pinned (Marketing@2026) and cannot be reset.' });
      }
      if (isProtectedAccount(targetRows[0].email) && String(targetRows[0].email).toLowerCase() === CEO_LOGIN_EMAIL) {
        return res.status(403).json({ error: 'The CEO account password can only be changed by the CEO.' });
      }

      const allowedRoles = MANAGED_ROLES[req.user.role] || [];
      if (!allowedRoles.includes(targetRows[0].role))
        return res.status(403).json({ error: 'You can only reset passwords for staff in your own department.' });

      const custom = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
      if (custom && custom.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      const nextPassword = custom || DEFAULT_PASSWORD;
      const mustChange = req.body?.must_change_password !== false && req.body?.must_change_password !== 'false';
      const hash = await bcrypt.hash(nextPassword, BCRYPT_COST);
      const { rows } = await db.query(
        'UPDATE users SET password_hash = $1, must_change_password = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name',
        [hash, mustChange, req.params.userId]
      );
      res.json({
        success: true,
        user: rows[0],
        password_set: !!custom,
        must_change_password: mustChange,
        message: custom
          ? (mustChange
            ? 'Password set. They must change it the next time they sign in.'
            : 'Password set. They can change it from Profile after signing in.')
          : 'Password reset. Share the configured temporary password with the user out of band.',
      });
    } catch (err) {
      console.error('Reset password error:', err.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

module.exports = {
  authRouter,
  authenticateSession,
  requirePasswordChanged,
  requireRole,
  validateSilverleafEmail,
  sanitizeAdditionalRoles,
  DEFAULT_PASSWORD,
  MANAGED_ROLES,
  TEAM_ADMIN_ROLES,
  ALL_ROLES,
  BCRYPT_COST,
  isProtectedAccount,
  isPinnedMarketingLogin,
  CEO_LOGIN_EMAIL,
  MARKETING_LOGIN_EMAIL,
};
