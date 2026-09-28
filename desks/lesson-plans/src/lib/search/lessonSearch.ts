import "server-only";

/**
 * lessonSearch — full-text + facet search over published lesson plans.
 *
 * The full-text index is a GIN over `to_tsvector('simple', search_text)`. We
 * combine three signals so search is forgiving:
 *   - `websearch_to_tsquery('simple', q)` matched against the tsvector (good
 *     ranking, handles multi-word queries, phrases, `-exclusions`),
 *   - a universal `ILIKE '%q%'` substring fallback (catches partial tokens and
 *     covers the case where `q` produces an EMPTY tsquery, e.g. a lone `-`),
 *   - optionally, trigram similarity — but ONLY on real Postgres and only when
 *     `SEARCH_TRIGRAM` is set, since `similarity()`/`%` don't exist on PGlite.
 *
 * The same WHERE predicate is shared with `facets.ts` via `buildPlanWhere` so
 * the result list and the facet counts always agree.
 *
 * `server-only`: this module touches the DB and must never reach a client
 * bundle.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";

import { db, getDbDriver } from "@/lib/db";
import { lessonPlans, searchMisses, type LessonPlan } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { eatNow } from "@/lib/time/eat";

/** A single facet selection: accepts one value or a list of values. */
export type FacetValue = string | string[];

/** Sort strategy. `relevance` only applies when a text query is present. */
export type SearchSort = "relevance" | "naming";

/** Shared filter inputs that define which published plans match. */
export interface PlanFilterParams {
  /** Free-text query. Trimmed; empty/whitespace means "no text filter". */
  q?: string;
  /** Subject facet (equality / IN). */
  subject?: FacetValue;
  /** Grade facet (equality / IN), matched against `lesson_plans.grade`. */
  grade?: FacetValue;
  /** Term facet (equality / IN), matched against `lesson_plans.term`. */
  term?: FacetValue;
}

/** Full search inputs: filters + sort + pagination + the caller's staff id. */
export interface SearchParams extends PlanFilterParams {
  sort?: SearchSort;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Rows per page. Defaults to {@link DEFAULT_PAGE_SIZE}. */
  pageSize?: number;
  /** The searching staff member (for content-gap miss logging). */
  staffId?: string;
}

/** A page of search results plus the total count over the same predicate. */
export interface SearchResult {
  rows: LessonPlan[];
  total: number;
}

/** Default rows per page. */
export const DEFAULT_PAGE_SIZE = 20;

/** Normalize a query: trim, and treat empty/whitespace as absent. */
function normalizeQuery(q: string | undefined): string {
  return (q ?? "").trim();
}

/** Should the optional trigram accelerator be used for this query? */
function shouldUseTrigram(): boolean {
  // env.SEARCH_TRIGRAM is a strict 1/true opt-in parsed to boolean in env.ts.
  return getDbDriver() === "postgres-js" && env.SEARCH_TRIGRAM;
}

/**
 * Build a facet predicate for a text column: `eq` for a single value, `inArray`
 * for a list. Empty arrays and absent values contribute nothing.
 */
function facetPredicate(
  column: AnyPgColumn,
  value: FacetValue | undefined,
): SQL | undefined {
  if (value === undefined) return undefined;
  const values = (Array.isArray(value) ? value : [value]).filter(
    (v) => v !== "",
  );
  if (values.length === 0) return undefined;
  return values.length === 1 ? eq(column, values[0]!) : inArray(column, values);
}

/**
 * The full-text arm: tsvector match OR the universal ILIKE substring fallback.
 * On Postgres with `SEARCH_TRIGRAM` set, also OR in a trigram-similarity arm.
 * Never emitted when `q` is empty (the caller omits it).
 */
function textPredicate(q: string): SQL {
  const tsvector = sql`to_tsvector('simple', ${lessonPlans.searchText})`;
  const tsquery = sql`websearch_to_tsquery('simple', ${q})`;
  // Escape LIKE metacharacters so a literal '%'/'_' in the query matches
  // itself instead of acting as a wildcard — a bare '_' would otherwise match
  // EVERY plan (pattern '%_%'), returning the whole catalogue and suppressing
  // the miss logging below. Parameterization already makes this injection-safe;
  // this is purely about match semantics.
  const escaped = q.replace(/[\\%_]/g, "\\$&");
  const ilike = sql`${lessonPlans.searchText} ILIKE ${"%" + escaped + "%"}`;

  if (shouldUseTrigram()) {
    return sql`(${tsvector} @@ ${tsquery} OR ${ilike} OR similarity(${lessonPlans.searchText}, ${q}) > 0.1)`;
  }
  return sql`(${tsvector} @@ ${tsquery} OR ${ilike})`;
}

/**
 * Compose the shared WHERE used by BOTH the result query and the facet counts.
 * Always constrains to `status = 'published'`. Returns a single `SQL` (the
 * `and(...)` of every active clause) so callers can drop it straight into
 * `.where(...)`.
 *
 * @param q  A normalized (already-trimmed) query string. Empty string ⇒ no
 *           text predicate.
 */
export function buildPlanWhere(params: PlanFilterParams): SQL {
  const q = normalizeQuery(params.q);

  const clauses: Array<SQL | undefined> = [
    eq(lessonPlans.status, "published"),
    facetPredicate(lessonPlans.subject, params.subject),
    facetPredicate(lessonPlans.grade, params.grade),
    facetPredicate(lessonPlans.term, params.term),
    q ? textPredicate(q) : undefined,
  ];

  // `and(...)` ignores undefined clauses; at least `status` is always present,
  // so the result is never undefined — assert that for the return type.
  return and(...clauses) as SQL;
}

/**
 * Naming-order tiebreak: grade → subject → term → week → lesson. Used as the
 * sole order for browse/naming sort, and as the secondary order after rank for
 * relevance sort.
 */
const namingOrder = [
  asc(lessonPlans.gradeNum),
  asc(lessonPlans.subject),
  asc(lessonPlans.termOrdinal),
  asc(lessonPlans.week),
  asc(lessonPlans.lesson),
] as const;

/**
 * Search published lesson plans.
 *
 * Ordering:
 *   - No query, or `sort === 'naming'` → naming order only.
 *   - Query present and `sort !== 'naming'` → `ts_rank` DESC, then naming order.
 *
 * Side effect: if a non-empty query yields zero results and a `staffId` is
 * given, a {@link searchMisses} row is logged (best-effort; failures here never
 * break search). Deduped to at most ONE row per (staff, query) per EAT day —
 * the force-dynamic search page re-runs on every debounced keystroke commit,
 * refresh, and back/forward navigation over the same URL, which would
 * otherwise log the same miss repeatedly and inflate the admin content-gap
 * counts.
 */
export async function searchLessonPlans(
  params: SearchParams,
): Promise<SearchResult> {
  const q = normalizeQuery(params.q);
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const where = buildPlanWhere(params);

  const wantRelevance = q !== "" && params.sort !== "naming";

  // Rank expression (only meaningful when a query is present).
  const rank = sql<number>`ts_rank(to_tsvector('simple', ${lessonPlans.searchText}), websearch_to_tsquery('simple', ${q}))`;

  const baseQuery = db.select().from(lessonPlans).where(where);

  const rowsPromise = wantRelevance
    ? baseQuery
        .orderBy(sql`${rank} DESC`, ...namingOrder)
        .limit(pageSize)
        .offset(offset)
    : baseQuery.orderBy(...namingOrder).limit(pageSize).offset(offset);

  const totalPromise = db
    .select({ value: count() })
    .from(lessonPlans)
    .where(where);

  const [rows, totalRows] = await Promise.all([rowsPromise, totalPromise]);
  const total = Number(totalRows[0]?.value ?? 0);

  // Content-gap logging: a real query that found nothing. Best-effort only.
  if (q !== "" && total === 0 && params.staffId) {
    try {
      // Dedupe: skip the insert when this staff member already logged the same
      // missed query today (EAT calendar day — the school's local day).
      const [latest] = await db
        .select({ occurredAt: searchMisses.occurredAt })
        .from(searchMisses)
        .where(
          and(
            eq(searchMisses.staffId, params.staffId),
            eq(searchMisses.query, q),
          ),
        )
        .orderBy(desc(searchMisses.occurredAt))
        .limit(1);
      const alreadyLoggedToday =
        latest !== undefined &&
        eatNow(latest.occurredAt).dateKey === eatNow().dateKey;
      if (!alreadyLoggedToday) {
        await db
          .insert(searchMisses)
          .values({ staffId: params.staffId, query: q });
      }
    } catch {
      // Never let miss-logging break the search response.
    }
  }

  return { rows, total };
}
