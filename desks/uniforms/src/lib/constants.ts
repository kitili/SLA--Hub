/** SKUs offered on new orders, requests, and PO lines. */
export const ACTIVE_SKU = { active: true } as const;
export const DEMO_PASSWORD = "Silverleaf@2026";
export const SESSION_COOKIE = "slu_session";
export const SCHOOL_COOKIE = "slu_school";
/** Cookie and JWT lifetime, in seconds. */
export const SESSION_MAX_AGE = 30 * 60;

export function sessionIssuedWithinTtl(iat: unknown): boolean {
  const issued = typeof iat === "number" ? iat : Number(iat);
  if (!Number.isFinite(issued) || issued <= 0) return false;
  return Math.floor(Date.now() / 1000) - issued <= SESSION_MAX_AGE;
}

export const ROLES = [
  "STORE",
  "TAILOR",
  "FINANCE",
  "CEO",
  "ADMIN",
  "HEAD_TEACHER",
  "PRINCIPAL",
  "PARENT",
] as const;

export type Role = (typeof ROLES)[number];

export const CAMPUS_CODES = ["USA", "AM", "KIJENGE", "ILBORU", "BOMA"] as const;
export type CampusCode = (typeof CAMPUS_CODES)[number];

export const LOCATION_CODES = {
  MAIN: "MAIN",
  SHOP_USA: "SHOP_USA",
} as const;

export const MOVE_REASONS = [
  "RECEIVE",
  "SEW_IN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "DISTRIBUTE",
  "PARENT_ISSUE",
  "ADJUST",
] as const;

export type MoveReason = (typeof MOVE_REASONS)[number];

export const ORDER_STATUSES = ["ORDERED", "PAID", "PARTIAL", "FULFILLED", "CANCELLED"] as const;
export const PAYMENT_CHANNELS = ["CASH", "LIPA", "UNIFORM_ACCOUNT"] as const;
export const PO_STATUSES = ["DRAFT", "SENT", "PARTIAL", "CLOSED", "CANCELLED"] as const;
export const REQUEST_STATUSES = ["OPEN", "FULFILLED", "CANCELLED"] as const;
export const SEWING_STATUSES = ["QUEUED", "IN_PROGRESS", "DONE"] as const;

export const STAFF_ROLES: Role[] = [
  "STORE",
  "TAILOR",
  "FINANCE",
  "CEO",
  "ADMIN",
  "HEAD_TEACHER",
  "PRINCIPAL",
];

export const ADMIN_CAMPUSES: CampusCode[] = ["USA", "AM"];
export const HT_CAMPUSES: CampusCode[] = ["KIJENGE", "ILBORU", "BOMA"];
