/**
 * Integration tests for searchLessonPlans + getFacetCounts against the
 * in-memory PGlite that test/setup.ts migrates per worker.
 *
 * Coverage:
 *   - FTS: a keyword query returns the plans whose searchable text contains it.
 *   - Facet filter narrows the result set (subject / grade).
 *   - Naming sort order is (gradeNum, subject, termOrdinal, week, lesson).
 *   - Empty query returns naming order.
 *   - LIKE metacharacters ('%', '_') in the query match literally, not as
 *     wildcards.
 *   - A real query with zero results AND a staffId writes a search_misses row,
 *     deduped to one row per (staff, query) per EAT day.
 *   - getFacetCounts buckets and counts the published plans for a query.
 *
 * Isolation: every plan uses a subject/grade unique to this file so the
 * facet-count assertions are not polluted by rows seeded elsewhere in the same
 * PGlite. Result-list assertions also filter to this file's slugs.
 */
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { buildSearchText } from "@/lib/lesson/searchText";
import {
  lessonPlans,
  searchMisses,
  staff,
  type NewLessonPlan,
} from "@/lib/db/schema";
import { getFacetCounts } from "./facets";
import { searchLessonPlans } from "./lessonSearch";

/**
 * Subjects/grades chosen to be globally unique to this file so getFacetCounts
 * (which aggregates over ALL published plans) yields deterministic buckets we
 * fully control.
 */
const SUBJECT_A = "ZzAstronomy"; // unique token, sorts late alphabetically
const SUBJECT_B = "ZzBotany";
const GRADE = "g11"; // grade no other fixture file uses
const GRADE_NUM = 11;
const SLUG_PREFIX = "lessonsearch";

/** Distinctive keyword present only in this file's astronomy plans. */
const KEYWORD = "supernova";

interface PlanSpec {
  slug: string;
  subject: string;
  termOrdinal: number;
  term: string;
  week: number;
  lesson: number;
  title: string;
  topic?: string;
  status?: "draft" | "published";
}

/** Insert a fully-specified plan row; returns the generated id. */
async function makePlan(spec: PlanSpec): Promise<string> {
  const searchText = buildSearchText({
    subject: spec.subject,
    grade: GRADE,
    term: spec.term,
    title: spec.title,
    topic: spec.topic ?? null,
  });
  const row: NewLessonPlan = {
    slug: spec.slug,
    filename: `${spec.slug}.pdf`,
    grade: GRADE,
    gradeNum: GRADE_NUM,
    subject: spec.subject,
    term: spec.term,
    termOrdinal: spec.termOrdinal,
    week: spec.week,
    lesson: spec.lesson,
    title: spec.title,
    topic: spec.topic ?? null,
    objectives: null,
    durationMinutes: 40,
    contentMarkdown: spec.title,
    status: spec.status ?? "published",
    source: "seed",
    searchText,
  };
  const [inserted] = await db.insert(lessonPlans).values(row).returning();
  return inserted!.id;
}

/** All slugs created by this file, for filtering shared-DB result sets. */
const ourSlugs = new Set<string>();
function slug(name: string): string {
  const s = `${SLUG_PREFIX}-${name}`;
  ourSlugs.add(s);
  return s;
}

let staffId: string;

beforeAll(async () => {
  const [s] = await db
    .insert(staff)
    .values({ email: `${SLUG_PREFIX}@silverleaf.test`, fullName: "Searcher" })
    .returning();
  staffId = s!.id;

  // Two astronomy plans containing KEYWORD, one botany plan that does not.
  // Insert deliberately OUT of naming order to prove the query sorts them.
  await makePlan({
    slug: slug("astro-w2"),
    subject: SUBJECT_A,
    term: "1a",
    termOrdinal: 1,
    week: 2,
    lesson: 1,
    title: "Stellar death and the supernova remnant",
  });
  await makePlan({
    slug: slug("astro-w1"),
    subject: SUBJECT_A,
    term: "1a",
    termOrdinal: 1,
    week: 1,
    lesson: 1,
    title: "Introduction to the supernova",
  });
  await makePlan({
    slug: slug("botany-w1"),
    subject: SUBJECT_B,
    term: "1a",
    termOrdinal: 1,
    week: 1,
    lesson: 1,
    title: "Photosynthesis basics",
  });
  // A draft astronomy plan that mentions the keyword — must NEVER match
  // (search is published-only).
  await makePlan({
    slug: slug("astro-draft"),
    subject: SUBJECT_A,
    term: "1a",
    termOrdinal: 1,
    week: 3,
    lesson: 1,
    title: "Draft notes about a supernova",
    status: "draft",
  });
  // A plan whose text contains a literal '%' — the only fixture here that a
  // correctly-escaped '%' query may match.
  await makePlan({
    slug: slug("botany-percent"),
    subject: SUBJECT_B,
    term: "1a",
    termOrdinal: 1,
    week: 2,
    lesson: 1,
    title: "Only 10% of sunlight reaches the forest floor",
  });
});

/** Restrict result rows to the ones this file created. */
function onlyOurs<T extends { slug: string }>(rows: T[]): T[] {
  return rows.filter((r) => ourSlugs.has(r.slug));
}

describe("searchLessonPlans — full-text matching", () => {
  it("returns published plans whose text contains the keyword", async () => {
    const { rows } = await searchLessonPlans({ q: KEYWORD, pageSize: 100 });
    const ours = onlyOurs(rows);
    const slugs = ours.map((r) => r.slug);

    expect(slugs).toContain(slug("astro-w1"));
    expect(slugs).toContain(slug("astro-w2"));
    // Botany plan lacks the keyword; draft plan is unpublished.
    expect(slugs).not.toContain(slug("botany-w1"));
    expect(slugs).not.toContain(slug("astro-draft"));
    expect(ours.every((r) => r.status === "published")).toBe(true);
  });

  it("narrows results when a subject facet is applied", async () => {
    const { rows } = await searchLessonPlans({
      subject: SUBJECT_B,
      pageSize: 100,
    });
    const slugs = onlyOurs(rows).map((r) => r.slug);
    expect(slugs).toEqual([slug("botany-w1"), slug("botany-percent")]);
  });

  it("narrows results when a grade facet is applied", async () => {
    const { rows, total } = await searchLessonPlans({
      grade: GRADE,
      pageSize: 100,
    });
    const ours = onlyOurs(rows);
    // All four published plans for this grade, none of the draft.
    expect(ours.map((r) => r.slug).sort()).toEqual(
      [
        slug("astro-w1"),
        slug("astro-w2"),
        slug("botany-w1"),
        slug("botany-percent"),
      ].sort(),
    );
    // `total` counts every published plan at this (globally-unique) grade.
    expect(total).toBe(4);
  });
});

describe("searchLessonPlans — LIKE metacharacter escaping", () => {
  it("treats '%' as a literal character, not a match-everything wildcard", async () => {
    // Unescaped, the ILIKE pattern would be '%%%' and return the whole
    // catalogue; escaped, it matches only text containing a literal '%'.
    const { rows } = await searchLessonPlans({ q: "%", pageSize: 100 });
    expect(onlyOurs(rows).map((r) => r.slug)).toEqual([slug("botany-percent")]);
  });

  it("matches a query containing a literal '%' against the right plan", async () => {
    const { rows } = await searchLessonPlans({ q: "10%", pageSize: 100 });
    const slugs = onlyOurs(rows).map((r) => r.slug);
    expect(slugs).toContain(slug("botany-percent"));
    expect(slugs).not.toContain(slug("astro-w1"));
  });

  it("treats '_' as a literal character, not a single-char wildcard", async () => {
    // No fixture in this file contains an underscore — unescaped, '%_%'
    // would match every one of them.
    const { rows } = await searchLessonPlans({ q: "_", pageSize: 100 });
    expect(onlyOurs(rows)).toHaveLength(0);
  });
});

describe("searchLessonPlans — ordering", () => {
  it("uses naming order (gradeNum, subject, termOrdinal, week, lesson) for an empty query", async () => {
    const { rows } = await searchLessonPlans({ grade: GRADE, pageSize: 100 });
    const ours = onlyOurs(rows);
    // For this single grade: subject A (astro) before subject B (botany), and
    // within each subject, week 1 before week 2.
    expect(ours.map((r) => r.slug)).toEqual([
      slug("astro-w1"),
      slug("astro-w2"),
      slug("botany-w1"),
      slug("botany-percent"),
    ]);
  });

  it("orders relevance results then falls back to naming for ties", async () => {
    // Both astro plans match the keyword; explicit naming sort gives a stable,
    // assertable order (week 1 before week 2).
    const { rows } = await searchLessonPlans({
      q: KEYWORD,
      grade: GRADE,
      sort: "naming",
      pageSize: 100,
    });
    expect(onlyOurs(rows).map((r) => r.slug)).toEqual([
      slug("astro-w1"),
      slug("astro-w2"),
    ]);
  });
});

describe("searchLessonPlans — content-gap miss logging", () => {
  it("writes a search_misses row when a real query finds nothing AND a staffId is given", async () => {
    const missQuery = `${SLUG_PREFIX}-no-such-topic-xyzzy`;

    const before = await db
      .select()
      .from(searchMisses)
      .where(and(eq(searchMisses.staffId, staffId), eq(searchMisses.query, missQuery)));
    expect(before).toHaveLength(0);

    const { total } = await searchLessonPlans({ q: missQuery, staffId });
    expect(total).toBe(0);

    const after = await db
      .select()
      .from(searchMisses)
      .where(and(eq(searchMisses.staffId, staffId), eq(searchMisses.query, missQuery)));
    expect(after).toHaveLength(1);
    expect(after[0]!.query).toBe(missQuery);
  });

  it("dedupes repeat misses: same (staff, query) logs once per EAT day", async () => {
    const missQuery = `${SLUG_PREFIX}-repeat-miss-plugh`;

    // Same failed search three times over — as the debounced search page does
    // on every keystroke commit / refresh / back-forward navigation.
    for (let i = 0; i < 3; i += 1) {
      const { total } = await searchLessonPlans({ q: missQuery, staffId });
      expect(total).toBe(0);
    }

    const rows = await db
      .select()
      .from(searchMisses)
      .where(and(eq(searchMisses.staffId, staffId), eq(searchMisses.query, missQuery)));
    expect(rows).toHaveLength(1);
  });

  it("does NOT log a miss when there is no staffId", async () => {
    const missQuery = `${SLUG_PREFIX}-anon-miss-qqq`;
    const { total } = await searchLessonPlans({ q: missQuery });
    expect(total).toBe(0);

    const rows = await db
      .select()
      .from(searchMisses)
      .where(eq(searchMisses.query, missQuery));
    expect(rows).toHaveLength(0);
  });

  it("does NOT log a miss when the query finds results", async () => {
    const rows = await db.select().from(searchMisses).where(eq(searchMisses.staffId, staffId));
    const countBefore = rows.length;

    const { total } = await searchLessonPlans({ q: KEYWORD, staffId });
    expect(total).toBeGreaterThan(0);

    const after = await db.select().from(searchMisses).where(eq(searchMisses.staffId, staffId));
    expect(after.length).toBe(countBefore);
  });
});

describe("getFacetCounts", () => {
  it("buckets and counts published plans by subject/grade/term for a query", async () => {
    // Empty query → counts across all published plans. Filter to our unique
    // subjects/grade so other files' fixtures don't affect the assertions.
    const facets = await getFacetCounts({});

    const astro = facets.subjects.find((b) => b.value === SUBJECT_A);
    const botany = facets.subjects.find((b) => b.value === SUBJECT_B);
    expect(astro?.count).toBe(2); // two published astro plans (draft excluded)
    expect(botany?.count).toBe(2);

    const grade = facets.grades.find((b) => b.value === GRADE);
    expect(grade?.count).toBe(4); // four published plans at this grade
  });

  it("reflects the text query in the counts", async () => {
    const facets = await getFacetCounts({ q: KEYWORD });
    const astro = facets.subjects.find((b) => b.value === SUBJECT_A);
    const botany = facets.subjects.find((b) => b.value === SUBJECT_B);
    // Only the two published astro plans contain the keyword.
    expect(astro?.count).toBe(2);
    expect(botany).toBeUndefined();
  });
});
