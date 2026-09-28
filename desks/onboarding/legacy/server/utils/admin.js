/**
 * HR admin access — emails listed in HR_ADMIN_EMAILS get is_admin on sign-in/register.
 */

export function getHrAdminEmails() {
  const raw = process.env.HR_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isHrAdminEmail(email) {
  if (!email) return false;
  return getHrAdminEmails().includes(email.trim().toLowerCase());
}

export function sanitizeStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    campus: row.campus,
    job_title: row.job_title,
    is_admin: Boolean(row.is_admin),
    created_at: row.created_at,
    last_active_at: row.last_active_at,
  };
}
