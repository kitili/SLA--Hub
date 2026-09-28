import { query } from '../db/pool.js';
import { isHrAdminEmail } from '../utils/admin.js';

export async function requireAdmin(req, res, next) {
  const staffId = req.headers['x-staff-id'];
  const pin = req.headers['x-admin-pin'];

  if (!staffId) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  if (!process.env.ADMIN_PIN) {
    return res.status(500).json({ error: 'Admin PIN not configured on server' });
  }

  if (!pin || pin !== process.env.ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  try {
    const result = await query(
      'SELECT id, email, full_name, is_admin FROM staff WHERE id = $1',
      [staffId]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const staff = result.rows[0];
    const admin = staff.is_admin || isHrAdminEmail(staff.email);

    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminStaff = staff;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/** Verify PIN without full admin route — checks HR email + PIN */
export async function verifyAdminPin(staffId, pin) {
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) {
    return { ok: false, error: 'Invalid PIN' };
  }
  const result = await query('SELECT id, email, is_admin FROM staff WHERE id = $1', [staffId]);
  if (!result.rows.length) return { ok: false, error: 'Invalid session' };
  const staff = result.rows[0];
  if (!staff.is_admin && !isHrAdminEmail(staff.email)) {
    return { ok: false, error: 'Not an admin email' };
  }
  return { ok: true };
}
