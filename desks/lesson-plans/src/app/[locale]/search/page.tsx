/**
 * Lesson-plan search page.
 *
 * The URL querystring is the single source of truth. This Server Component
 * reads `q`, the repeated facet params (`subject`/`grade`/`term`), `sort`, and
 * `page`, runs the search + facet-count queries in parallel, and renders the
 * mobile-first results UI. The interactive <SearchFilters> writes the URL back,
 * which re-runs this component (it is `force-dynamic`, so never cached).
 */
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth";
import { searchLessonPlans, type SearchSort } from "@/lib/search/lessonSearch";
import { getFacetCounts } from "@/lib/search/facets";
import SearchFilters from "@/components/lesson/SearchFilters";
import PlanResultList from "@/components/lesson/PlanResultList";
import styles from "./page.module.css";

/** Live, authenticated data — render on demand (never prerender/cache). */
export const dynamic = "force-dynamic";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    subject?: string | string[];
    grade?: string | string[];
    term?: string | string[];
    sort?: string;
    page?: string;
  }>;
}

/**
 * Normalize a querystring value into a clean `string[]`. A repeated key arrives
 * as an array; a single key as a string; an absent key as `undefined`. Empty
 * entries are dropped.
 */
function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter((v) => v !== "");
}

/** Parse the `page` param to a 1-based positive integer (defaults to 1). */
function toPage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations("lpSearch");

  const q = (sp.q ?? "").trim();
  const subjects = toList(sp.subject);
  const grades = toList(sp.grade);
  const terms = toList(sp.term);
  const page = toPage(sp.page);
  // Relevance is the only non-default sort; everything else falls back to
  // naming order.
  const sort: SearchSort = sp.sort === "relevance" ? "relevance" : "naming";

  const filterParams = {
    q,
    subject: subjects,
    grade: grades,
    term: terms,
  };

  const [{ rows, total }, facets] = await Promise.all([
    searchLessonPlans({
      ...filterParams,
      sort,
      page,
      staffId: user.id,
    }),
    getFacetCounts(filterParams),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.sub}>{t("subtitle")}</p>
      </header>

      <SearchFilters
        q={q}
        subjects={facets.subjects}
        grades={facets.grades}
        terms={facets.terms}
        selectedSubjects={subjects}
        selectedGrades={grades}
        selectedTerms={terms}
        sort={sort}
      />

      <PlanResultList rows={rows} total={total} />
    </main>
  );
}
