export const TICKET_CATEGORIES = [
  "hardware",
  "software",
  "network",
  "access",
  "facilities",
  "other",
] as const;

export const TICKET_IMPACTS = ["individual", "classroom", "campus"] as const;

export const TICKET_SOURCES = ["public", "internal"] as const;

export const TICKET_SLA_HOURS = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 168,
} as const;

export const TICKET_CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  hardware: "Hardware / device",
  software: "Software",
  network: "Network / wifi",
  access: "Login / access",
  facilities: "Facilities",
  other: "Other",
};

export const TICKET_IMPACT_LABELS: Record<(typeof TICKET_IMPACTS)[number], string> = {
  individual: "One person",
  classroom: "A class or office",
  campus: "Whole campus",
};

export function slaDueAt(priority: keyof typeof TICKET_SLA_HOURS, from = new Date()) {
  return new Date(from.getTime() + TICKET_SLA_HOURS[priority] * 60 * 60 * 1000);
}
