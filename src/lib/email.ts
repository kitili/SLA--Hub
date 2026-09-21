const DEFAULT_DOMAINS = ["silverleaf.co.tz", "silverleaf.ac.tz"];

export function getAllowedEmailDomains(): string[] {
  const raw =
    process.env.ALLOWED_EMAIL_DOMAINS?.trim() ||
    process.env.ALLOWED_EMAIL_DOMAIN?.trim();
  if (!raw) return DEFAULT_DOMAINS;
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedEmailDomain(): string {
  return getAllowedEmailDomains()[0] ?? DEFAULT_DOMAINS[0];
}

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedStaffEmail(email: string): boolean {
  const normalized = normalizeStaffEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }
  return getAllowedEmailDomains().some((domain) => normalized.endsWith(`@${domain}`));
}

export function validateStaffEmail(email: string): string | null {
  if (!email?.trim()) {
    return "Work email is required";
  }
  if (!isAllowedStaffEmail(email)) {
    return `Only ${getAllowedEmailDomains().map((domain) => `@${domain}`).join(" or ")} work emails can sign in`;
  }
  return null;
}
