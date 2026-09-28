import { Router } from 'express';
import { query } from '../db/pool.js';
import { isHrAdminEmail, sanitizeStaff } from '../utils/admin.js';
import { normalizeStaffEmail, validateStaffEmail } from '../utils/email.js';

const router = Router();

async function upsertAdminFlag(staff) {
  const shouldBeAdmin = isHrAdminEmail(staff.email);
  if (shouldBeAdmin && !staff.is_admin) {
    await query('UPDATE staff SET is_admin = TRUE WHERE id = $1', [staff.id]);
    return { ...staff, is_admin: true };
  }
  return { ...staff, is_admin: Boolean(staff.is_admin) || shouldBeAdmin };
}

router.post('/signin', async (req, res) => {
  try {
    const { email } = req.body;
    const emailError = validateStaffEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    const normalizedEmail = normalizeStaffEmail(email);
    const existing = await query('SELECT * FROM staff WHERE email = $1', [normalizedEmail]);

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'No account found. Please complete registration.' });
    }

    await query('UPDATE staff SET last_active_at = NOW() WHERE id = $1', [existing.rows[0].id]);
    const staff = await upsertAdminFlag(existing.rows[0]);
    res.json({ staff: sanitizeStaff(staff) });
  } catch (err) {
    console.error('Staff signin error:', err);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    const emailError = validateStaffEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    const normalizedEmail = normalizeStaffEmail(email);
    const isAdmin = isHrAdminEmail(normalizedEmail);

    const existing = await query('SELECT * FROM staff WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      await query('UPDATE staff SET last_active_at = NOW() WHERE id = $1', [existing.rows[0].id]);
      const staff = await upsertAdminFlag(existing.rows[0]);
      return res.json({ staff: sanitizeStaff(staff) });
    }

    if (!fullName?.trim()) {
      return res.status(400).json({ error: 'Please enter your name' });
    }

    const result = await query(
      `INSERT INTO staff (email, full_name, campus, job_title, is_admin)
       VALUES ($1, $2, NULL, NULL, $3)
       RETURNING *`,
      [normalizedEmail, fullName.trim(), isAdmin]
    );

    res.status(201).json({ staff: sanitizeStaff(result.rows[0]) });
  } catch (err) {
    console.error('Staff register error:', err);
    res.status(500).json({ error: 'Could not register staff' });
  }
});

router.get('/:staffId', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, campus, job_title, is_admin, created_at FROM staff WHERE id = $1',
      [req.params.staffId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Staff not found' });
    const staff = await upsertAdminFlag(result.rows[0]);
    res.json({ staff: sanitizeStaff(staff) });
  } catch (err) {
    console.error('Staff get error:', err);
    res.status(500).json({ error: 'Could not fetch staff' });
  }
});

export default router;
