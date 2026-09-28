/**
 * Admin plans listing — shared query helpers.
 *
 * One source of truth for filtering, ordering and paging the lesson-plans
 * catalogue, imported by BOTH the server page (`/admin/plans`) and the
 * `loadMorePlans` server action so the two never drift. Filters are intentionally
 * narrow and map onto indexed columns (`grade`, `subject`, `status`) plus a
 * substring match over the denormalised, lowercased `search_text` blob.
 */
import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { lessonPlans, type PlanStatus } from "@/lib/db/schema";

/** Rows loaded per page / per "Show more". */
export const PAGE_SIZE = 12;

/** Minimal plan shape the admin table needs. */
export interface PlanRow {
  id: string;
  slug: string;
  title: string;
  grade: string;
  subject: string;
  term: string;
  week: number;
  lesson: number;
  status: PlanStatus;
}

/** Active filters. All optional — an absent key means "no constraint". */
export interface PlanFilters {
  grade?: string;
  subject?: string;
  status?: PlanStatus;
  q?: string;
}

/** The columns the listing selects, in one place. */
const PLAN_COLUMNS = {
  id: lessonPlans.id,
  slug: lessonPlans.slug,
  title: lessonPlans.title,
  grade: lessonPlans.grade,
  subject: lessonPlans.subject,
  term: lessonPlans.term,
  week: lessonPlans.week,
  lesson: lessonPlans.lesson,
  status: lessonPlans.status,
} as const;

/**
 * Normalise raw `searchParams` into a typed, trimmed {@link PlanFilters}.
 * Unknown / blank values are dropped; `status` is validated against the enum.
 */
export function parsePlanFilters(
  raw: Record<string, string | string[] | undefined>,
): PlanFilters {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

  const status = one(raw.status);

  return {
    grade: one(raw.grade),
    subject: one(raw.subject),
    status: status === "draft" || status === "published" ? status : undefined,
    q: one(raw.q),
  };
}

/** Build the combined WHERE clause for a filter set (or undefined for none). */
function whereFor(filters: PlanFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (filters.grade) conds.push(eq(lessonPlans.grade, filters.grade));
  if (filters.subject) conds.push(eq(lessonPlans.subject, filters.subject));
  if (filters.status) conds.push(eq(lessonPlans.status, filters.status));
  // `search_text` is already lowercased; ilike keeps it case-insensitive anyway.
  if (filters.q) conds.push(ilike(lessonPlans.searchText, `%${filters.q}%`));
  return conds.length > 0 ? and(...conds) : undefined;
}

/**
 * Fetch one page of plans matching `filters`, in the canonical naming order
 * (grade → subject → term → week → lesson).
 */
export async function fetchPlansPage(
  filters: PlanFilters,
  { offset, limit }: { offset: number; limit: number },
): Promise<PlanRow[]> {
  return db
    .select(PLAN_COLUMNS)
    .from(lessonPlans)
    .where(whereFor(filters))
    .orderBy(
      asc(lessonPlans.gradeNum),
      asc(lessonPlans.subject),
      asc(lessonPlans.termOrdinal),
      asc(lessonPlans.week),
      asc(lessonPlans.lesson),
    )
    .limit(limit)
    .offset(offset);
}

/** Total number of plans matching `filters` (for the header count). */
export async function countPlans(filters: PlanFilters): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(lessonPlans)
    .where(whereFor(filters));
  return Number(rows[0]?.value ?? 0);
}

/** Distinct grade/subject values for the filter dropdowns. */
export interface PlanFilterOptions {
  grades: string[];
  subjects: string[];
}

/**
 * Distinct grades (ordered by numeric grade) and subjects (alphabetical) for the
 * filter selects. Cheap — two small DISTINCT scans over indexed columns.
 */
export async function fetchPlanFilterOptions(): Promise<PlanFilterOptions> {
  const [grades, subjects] = await Promise.all([
    db
      .selectDistinct({ grade: lessonPlans.grade, gradeNum: lessonPlans.gradeNum })
      .from(lessonPlans)
      .orderBy(asc(lessonPlans.gradeNum)),
    db
      .selectDistinct({ subject: lessonPlans.subject })
      .from(lessonPlans)
      .orderBy(asc(lessonPlans.subject)),
  ]);

  return {
    grades: grades.map((g) => g.grade),
    subjects: subjects.map((s) => s.subject),
  };
}
