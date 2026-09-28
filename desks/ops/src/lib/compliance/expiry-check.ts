export type ComplianceStatus = "ok" | "expiring_soon" | "expired" | "missing";

export type ComplianceCheck = {
  status: ComplianceStatus;
  note: string;
  days_remaining: number | null;
};

export const EXPIRING_SOON_DAYS = 7;

export function daysUntil(expiry: string): number {
  const expiryMs = Date.parse(expiry);
  return Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000));
}

export function classifyDays(days: number): Exclude<ComplianceStatus, "missing"> {
  if (days < 0) return "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "ok";
}

// Worst-first: an unrecorded expiry is unverified compliance, not a lesser
// concern than a known upcoming renewal.
export const SEVERITY_ORDER: Record<ComplianceStatus, number> = {
  expired: 0,
  missing: 1,
  expiring_soon: 2,
  ok: 3,
};

export function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  return statuses.reduce<ComplianceStatus>(
    (worst, status) => (SEVERITY_ORDER[status] <= SEVERITY_ORDER[worst] ? status : worst),
    "ok",
  );
}

// Given a record of named checks, returns the single worst one. Ties resolve
// to whichever key comes first in the record's insertion order.
// Shared badge coloring for this status taxonomy — same convention used on
// the Drivers and Maintenance pages, so a bus flagged in one place looks the
// same everywhere rather than each page inventing its own severity color.
export const COMPLIANCE_STATUS_STYLES: Record<ComplianceStatus, string> = {
  ok: "bg-success-15 text-success",
  expiring_soon: "bg-gold-15 text-ink",
  expired: "bg-danger-15 text-danger",
  missing: "bg-light-blue-30 text-ink-muted",
};

export function pickWorst<T extends { status: ComplianceStatus }>(
  checks: Record<string, T>,
): { key: string; check: T } | null {
  const entries = Object.entries(checks);
  if (entries.length === 0) return null;
  let worst = entries[0]!;
  for (const entry of entries.slice(1)) {
    if (SEVERITY_ORDER[entry[1].status] < SEVERITY_ORDER[worst[1].status]) {
      worst = entry;
    }
  }
  return { key: worst[0], check: worst[1] };
}
