import type { Role } from "@/lib/roles";

/** Roles that can read/write Facilities via /ops/facilities and /api/facilities. */
export const FACILITIES_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
];
