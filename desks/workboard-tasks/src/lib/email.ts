const DEFAULT_DOMAIN = "silverleaf.co.tz";

export function getAllowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).trim().toLowerCase();
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedStaffEmail(email: string): boolean {
  const normalized = normalizeStaffEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  return normalized.endsWith(`@${getAllowedEmailDomain()}`);
}
