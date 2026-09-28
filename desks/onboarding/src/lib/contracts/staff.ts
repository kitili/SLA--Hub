/**
 * StaffDTO — the sanitized staff shape returned to API clients.
 *
 * Field set is derived from the legacy `sanitizeStaff` helper
 * (legacy/server/utils/admin.js) and the PostgreSQL schema
 * (legacy/server/db/schema.sql).  Snake_case mirrors the database column names
 * so the mapping layer stays trivial; camelCase aliases are in the Zod schema.
 */
export interface StaffDTO {
  id: string;
  email: string;
  full_name: string;
  campus: string | null;
  job_title: string | null;
  is_admin: boolean;
  /** ISO-8601 timestamp string */
  created_at: string;
  /** ISO-8601 timestamp string */
  last_active_at: string;
}
