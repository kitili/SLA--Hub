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

const USERNAME_DOMAIN = "silverleaf.co.tz";

export function getPreferredWorkDomain(): string {
  return USERNAME_DOMAIN;
}

/** Lowercase name with punctuation stripped — used to spot similar people. */
export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesAreSimilar(a: string, b: string): boolean {
  const left = normalizePersonName(a);
  const right = normalizePersonName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftParts = left.split(" ");
  const rightParts = right.split(" ");
  if (leftParts[0] !== rightParts[0]) return false;
  const leftLast = leftParts.slice(1).join(" ");
  const rightLast = rightParts.slice(1).join(" ");
  if (!leftLast || !rightLast) return leftParts.length === 1 && rightParts.length === 1;
  return leftLast === rightLast || leftLast.startsWith(rightLast) || rightLast.startsWith(leftLast);
}

/** Accept `paul.kimaro` or `paul.kimaro@silverleaf.co.tz`. Always ends @silverleaf.co.tz. */
export function parseUniqueWorkEmail(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const email = raw.includes("@") ? raw : `${raw}@${USERNAME_DOMAIN}`;
  if (!isAllowedStaffEmail(email)) return null;
  if (!email.endsWith(`@${USERNAME_DOMAIN}`)) return null;
  const local = email.slice(0, email.lastIndexOf("@"));
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(local)) return null;
  if (local.includes("..") || local.endsWith(".") || local.endsWith("-")) return null;
  return email;
}

export function suggestWorkEmailFromName(fullName: string, taken: Set<string> = new Set()): string {
  const parts = normalizePersonName(fullName).split(" ").filter(Boolean);
  const first = parts[0] ?? "staff";
  const last = parts.slice(1).join("");
  const bases = last
    ? [`${first}.${last}`, `${first}${last}`, `${first}.${last[0]}`]
    : [first];
  for (const base of bases) {
    const email = `${base}@${USERNAME_DOMAIN}`;
    if (!taken.has(email)) return email;
  }
  for (let i = 2; i < 50; i += 1) {
    const email = `${first}.${last || "staff"}${i}@${USERNAME_DOMAIN}`;
    if (!taken.has(email)) return email;
  }
  return `${first}.${Date.now()}@${USERNAME_DOMAIN}`;
}
