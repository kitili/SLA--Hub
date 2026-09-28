/**
 * Canonical Ops ↔ Ticket Desk department mapping.
 * Desk stores free-text `requests.department` (see public/ticketing DEPARTMENTS).
 */

export const TICKETING_DEPARTMENTS = [
  "Transport",
  "Facilities",
  "Kitchen",
  "Security",
  "Farms",
] as const;

export type TicketingDepartment = (typeof TICKETING_DEPARTMENTS)[number];

/** Ops hub / app domain ids that map onto a desk department. */
export type OpsTicketDomainId =
  | "transport"
  | "facilities"
  | "kitchen"
  | "farm"
  | "security";

export const OPS_DOMAIN_TO_TICKETING_DEPT: Record<
  OpsTicketDomainId,
  TicketingDepartment
> = {
  transport: "Transport",
  facilities: "Facilities",
  kitchen: "Kitchen",
  farm: "Farms",
  security: "Security",
};

export type TicketingDeepLink = {
  /** Desk department name (e.g. Facilities). */
  department?: TicketingDepartment | string;
  /** Ops domain id — converted to desk department. */
  domain?: OpsTicketDomainId;
  /** Prefer opening the new-ticket form after sign-in. */
  action?: "new" | "list";
  title?: string;
  details?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  campus?: string;
  /** Originating domain record, e.g. facilities_issue / farm_alert / incident. */
  sourceType?: string;
  sourceId?: string;
  /** Prefer Ops iframe shell when true (default). */
  viaOps?: boolean;
};

export function resolveTicketingDepartment(
  input: Pick<TicketingDeepLink, "department" | "domain">,
): TicketingDepartment | undefined {
  if (input.domain && OPS_DOMAIN_TO_TICKETING_DEPT[input.domain]) {
    return OPS_DOMAIN_TO_TICKETING_DEPT[input.domain];
  }
  if (
    input.department &&
    (TICKETING_DEPARTMENTS as readonly string[]).includes(input.department)
  ) {
    return input.department as TicketingDepartment;
  }
  return undefined;
}

/** Build a desk URL that pre-fills department / new-ticket draft. */
export function ticketingHref(link: TicketingDeepLink = {}): string {
  const params = new URLSearchParams();
  const department = resolveTicketingDepartment(link);
  if (department) params.set("dept", department);
  if (link.action) params.set("action", link.action);
  if (link.title) params.set("title", link.title);
  if (link.details) params.set("details", link.details);
  if (link.category) params.set("category", link.category);
  if (link.priority) params.set("priority", link.priority);
  if (link.campus) params.set("campus", link.campus);
  if (link.sourceType) params.set("sourceType", link.sourceType);
  if (link.sourceId) params.set("sourceId", link.sourceId);

  const qs = params.toString();
  const viaOps = link.viaOps !== false;
  const base = viaOps ? "/ops/ticketing" : "/ticketing/index.html";
  return qs ? `${base}?${qs}` : base;
}
