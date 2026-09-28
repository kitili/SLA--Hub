const DEFAULT_DOMAIN = 'silverleaf.co.tz';

export function getAllowedEmailDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();
}

export function normalizeStaffEmail(email) {
  return email?.trim().toLowerCase() ?? '';
}

export function isAllowedStaffEmail(email) {
  const normalized = normalizeStaffEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  return normalized.endsWith(`@${getAllowedEmailDomain()}`);
}

export function validateStaffEmail(email) {
  if (!email?.trim()) {
    return 'Work email is required';
  }
  if (!isAllowedStaffEmail(email)) {
    return `Only @${getAllowedEmailDomain()} work emails can sign in`;
  }
  return null;
}
