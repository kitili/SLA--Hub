import "server-only";

/**
 * facets — faceted counts for the search UI.
 *
 * Each facet (subject / grade / term) is a GROUP BY aggregate over the SAME
 * published-plan predicate that `searchLessonPlans` uses (via the shared
 * `buildPlanWhere`), so the sidebar counts always reflect the current text
 * query. Counts are computed against the text predicate only — they are NOT
 * narrowed by the *other* currently-selected facets, so the user can always see
 * (and switch to) sibling values rather than dead-ending on a single choice.
 *
 * Sorting: subjects alphabetically, grades by numeric grade, terms by their
 * chronological ordinal.
 */
import { asc, count, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { lessonPlans } from "@/lib/db/schema";
import { buildPlanWhere, type PlanFilterParams } from "./lessonSearch";

/** One facet bucket: the value and how many published plans carry it. */
export interface FacetCount {
  value: string;
  count: number;
}

/** The three facet dimensions surfaced in the search UI. */
export interface FacetCounts {
  subjects: FacetCount[];
  grades: FacetCount[];
  terms: FacetCount[];
}

/**
 * Count facet buckets for the current text query.
 *
 * Only `q` from `params` is honoured (the text predicate). The selected
 * subject/grade/term are intentionally ignored so each dimension shows its full
 * set of available values for the query — the page highlights which ones are
 * selected separately.
 */
export async function getFacetCounts(
  params: PlanFilterParams,
): Promise<FacetCounts> {
  // Reuse the shared predicate, but only with the text query — facet selections
  // must not narrow the buckets we offer.
  const where = buildPlanWhere({ q: params.q });

  const [subjects, grades, terms] = await Promise.all([
    db
      .select({ value: lessonPlans.subject, count: count() })
      .from(lessonPlans)
      .where(where)
      .groupBy(lessonPlans.subject)
      .orderBy(asc(lessonPlans.subject)),
    db
      .select({
        value: lessonPlans.grade,
        count: count(),
        // carried only for ordering by numeric grade
        gradeNum: sql<number>`min(${lessonPlans.gradeNum})`,
      })
      .from(lessonPlans)
      .where(where)
      .groupBy(lessonPlans.grade)
      .orderBy(asc(sql`min(${lessonPlans.gradeNum})`)),
    db
      .select({
        value: lessonPlans.term,
        count: count(),
        termOrdinal: sql<number>`min(${lessonPlans.termOrdinal})`,
      })
      .from(lessonPlans)
      .where(where)
      .groupBy(lessonPlans.term)
      .orderBy(asc(sql`min(${lessonPlans.termOrdinal})`)),
  ]);

  return {
    subjects: subjects.map((r) => ({
      value: r.value,
      count: Number(r.count),
    })),
    grades: grades.map((r) => ({ value: r.value, count: Number(r.count) })),
    terms: terms.map((r) => ({ value: r.value, count: Number(r.count) })),
  };
}
