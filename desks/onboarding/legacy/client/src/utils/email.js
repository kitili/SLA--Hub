export const ALLOWED_EMAIL_DOMAIN = 'silverleaf.co.tz';

export function normalizeStaffEmail(email) {
  return email?.trim().toLowerCase() ?? '';
}

export function isAllowedStaffEmail(email) {
  const normalized = normalizeStaffEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  return normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export function validateStaffEmail(email) {
  if (!email?.trim()) {
    return 'Work email is required';
  }
  if (!isAllowedStaffEmail(email)) {
    return `Please use your Silverleaf work email (@${ALLOWED_EMAIL_DOMAIN})`;
  }
  return null;
}
