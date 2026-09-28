/**
 * CLI: seed the active database (idempotent).
 *
 *   npm run db:seed
 *
 * Steps (each safe to re-run):
 *   1. Run migrations.
 *   2. Upsert demo staff by email (an HR admin + a teacher) so the local PGlite
 *      demo can sign in.
 *   3. Parse and insert the example scheme(s) of work from `SOW-examples/`.
 *   4. Insert the example lesson plans (source 'seed', status 'published'),
 *      idempotent on slug, linking each to its scheme row where there is one.
 *   5. Seed demo activity for the test teacher: a handful of usage events and a
 *      couple of feedback rows — deliberately leaving several used-but-unrated
 *      plans so the Feedback Hour has items to surface.
 *
 * NOTE: every insert here is `onConflictDoNothing`, so re-running against an
 * already-seeded database changes nothing — it will NOT update existing rows.
 * Use `npm run db:reset` to rebuild the corpus after editing the samples.
 *
 * Intended for local PGlite dev; harmless against an empty Postgres too.
 */
import { eq } from "drizzle-orm";

import { applyKnownIdentifier } from "@/lib/ai/lessonPlan/identifier";
import { DEFAULT_PROMPT_PARTS } from "@/lib/ai/lessonPlan/promptDefaults";
import { renderLessonMarkdown } from "@/lib/ai/lessonPlan/renderMarkdown";
import { validateLessonPlan } from "@/lib/ai/lessonPlan/validate";
import { buildSearchText } from "@/lib/lesson/searchText";
import { buildFilename } from "@/lib/naming/format";
import { parse } from "@/lib/naming/parse";

import { db } from "../client";
import { runMigrations } from "../migrate";
import { findStaffByEmail, upsertStaffByEmail } from "../repositories/staff";
import {
  lessonPlans,
  planFeedback,
  planUsageEvents,
  promptParts,
  type NewLessonPlan,
  type UsageEventType,
} from "../schema";
import { SAMPLE_PLANS, type SamplePlan } from "./sampleLessonPlans";
import { seedSchemes, type SeededScheme } from "./seedSchemes";

const DEMO_STAFF = [
  {
    email: "hr@silverleaf.co.tz",
    fullName: "HR Admin",
    campus: "Main",
    jobTitle: "People Operations",
    isAdmin: true,
  },
  {
    email: "teacher@silverleaf.co.tz",
    fullName: "Test Teacher",
    campus: "Main",
    jobTitle: "Teacher",
    isAdmin: false,
  },
] as const;

/** Email of the teacher whose demo activity we seed. */
const DEMO_TEACHER_EMAIL = "teacher@silverleaf.co.tz";

/** A Date `daysAgo` days before now (whole days). */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Resolve a sample's `schemeRef` to the id of the seeded `sow_lessons` row it
 * was authored from, or `undefined` when the sample names no scheme.
 *
 * The schemes number lessons continuously across the term ("L3 Wk3 · P1"),
 * while the app restarts them each week — so the ref addresses a row by its
 * position within the week rather than by the scheme's own printed label.
 */
function resolveSchemeLessonId(
  plan: SamplePlan,
  schemes: SeededScheme[],
): string | undefined {
  const { schemeRef } = plan;
  if (!schemeRef) return undefined;

  const scheme = schemes.find((s) => s.subject === schemeRef.subject);
  if (!scheme) {
    throw new Error(
      `[db:seed] sample "${plan.subject} W${plan.week} L${plan.lesson}" references ` +
        `scheme "${schemeRef.subject}", which was not seeded.`,
    );
  }

  const inWeek = scheme.lessons.filter((l) => l.week === schemeRef.week);
  const row = inWeek[schemeRef.indexInWeek];
  if (!row) {
    throw new Error(
      `[db:seed] scheme "${schemeRef.subject}" week ${schemeRef.week} has no lesson at ` +
        `index ${schemeRef.indexInWeek} (found ${inWeek.length}).`,
    );
  }
  return row.id;
}

/**
 * Insert the example plans, deriving every column from the authored
 * {@link SamplePlan.structured} body exactly as `savePlanStructured` does
 * (`@/lib/actions/aiStudio`), so a seeded plan matches a generated one.
 *
 * Two deliberate departures, both honest: `source` is `'seed'` rather than
 * `'ai'` (provenance, not format), and `durationMinutes` comes from the
 * scheme's own period length instead of the generator's hardcoded 40.
 *
 * Idempotent: `onConflictDoNothing` on the unique slug, so re-running never
 * duplicates rows — but note it will not update them either.
 *
 * @param schemes The seeded schemes, for resolving `scheme_lesson_id`.
 * @returns How many rows were submitted (already-present ones are ignored).
 */
async function seedPlans(schemes: SeededScheme[]): Promise<number> {
  const rows: NewLessonPlan[] = [];

  for (const plan of SAMPLE_PLANS) {
    const filename = buildFilename({
      grade: plan.grade,
      subject: plan.subject,
      term: plan.term,
      week: plan.week,
      lesson: plan.lesson,
    });

    const parsed = parse(filename);
    if (!parsed.ok) {
      // Authored corpus: a parse failure is a bug in the sample data, so make
      // it loud rather than silently dropping the row.
      throw new Error(
        `[db:seed] sample plan "${filename}" failed to parse: ${parsed.reason}`,
      );
    }

    // A body that fails the schema or the semantic guards would still insert,
    // then silently render as the plain-markdown fallback instead of the
    // branded document. Fail the seed instead — see `sampleLessonPlans.test.ts`.
    const issues = validateLessonPlan(plan.structured);
    if (issues.length > 0) {
      throw new Error(
        `[db:seed] sample plan "${filename}" is not a valid structured plan:\n  - ` +
          issues.join("\n  - "),
      );
    }

    const { grade, gradeNum, subject, term, termOrdinal, week, lesson, slug } =
      parsed.value;

    // Same overwrite the save path applies, so content_json and the rendered
    // markdown header can never disagree with the filename/slug.
    const normalized = applyKnownIdentifier(plan.structured, {
      grade,
      subject,
      term,
      week,
      lesson,
    });

    const contentMarkdown = renderLessonMarkdown(normalized);
    const title = normalized.identifier.title;
    const topic = normalized.identifier.specific_competence;
    const objectives = normalized.success_criteria;

    rows.push({
      slug,
      filename,
      grade,
      gradeNum,
      subject,
      term,
      termOrdinal,
      week,
      lesson,
      title,
      topic,
      objectives,
      durationMinutes: plan.durationMinutes,
      contentMarkdown,
      contentJson: normalized,
      status: "published",
      source: "seed",
      schemeLessonId: resolveSchemeLessonId(plan, schemes),
      searchText: buildSearchText({
        subject,
        grade,
        term,
        title,
        topic,
        objectives,
        contentMarkdown,
      }),
    });
  }

  await db
    .insert(lessonPlans)
    .values(rows)
    .onConflictDoNothing({ target: lessonPlans.slug });

  return rows.length;
}

/** Look up the id of a seeded plan by slug, or `undefined` if absent. */
async function planIdBySlug(slug: string): Promise<string | undefined> {
  const rows = await db
    .select({ id: lessonPlans.id })
    .from(lessonPlans)
    .where(eq(lessonPlans.slug, slug))
    .limit(1);
  return rows[0]?.id;
}

/**
 * Seed demo activity for the test teacher.
 *
 * Inserts ~5 usage events across several plans (varying `occurredAt` so some
 * are within the last few days) and ~2 feedback rows. Crucially, several used
 * plans are left WITHOUT feedback so the Feedback Hour home has unrated,
 * recently-used items to prompt on.
 *
 * Idempotent: usage events are append-only, so we only insert them if the
 * teacher has none yet; feedback uses `onConflictDoNothing` on the unique
 * (staff_id, plan_id) index.
 */
async function seedDemoActivity(): Promise<{
  usageInserted: number;
  feedbackInserted: number;
}> {
  const teacher = await findStaffByEmail(DEMO_TEACHER_EMAIL);
  if (!teacher) {
    console.log(
      `[db:seed] demo teacher ${DEMO_TEACHER_EMAIL} not found; skipping activity`,
    );
    return { usageInserted: 0, feedbackInserted: 0 };
  }
  const staffId = teacher.id;

  // Plans the teacher has "used". Both subjects; the first two will also be
  // rated, the rest are left unrated on purpose for the Feedback Hour.
  //
  // The most recent event is what "your next lessons" anchors on, so the newest
  // one below (Arithmetic W2 L1) is what the home page offers successors from.
  const usedSlugs = [
    "g2-arithmetic-t1a-w2-l1", // will be rated
    "g2-arithmetic-t1a-w2-l2", // will be rated
    "g2-healthandenvironment-t1a-w2-l1", // unrated
    "g2-healthandenvironment-t1a-w2-l2", // unrated
    "g2-arithmetic-t1a-w2-l3", // unrated
  ];

  const slugToId = new Map<string, string>();
  for (const slug of usedSlugs) {
    const id = await planIdBySlug(slug);
    if (id) slugToId.set(slug, id);
  }

  // --- Usage events (append-only): only seed once. ---
  const existingUsage = await db
    .select({ id: planUsageEvents.id })
    .from(planUsageEvents)
    .where(eq(planUsageEvents.staffId, staffId))
    .limit(1);

  let usageInserted = 0;
  if (existingUsage.length === 0) {
    const usageSeeds: { slug: string; eventType: UsageEventType; when: Date }[] = [
      // Newest, and the only one at daysAgo(0): this is the cursor "your next
      // lessons" anchors on, so the home page offers Arithmetic W2 L2 and L3.
      { slug: "g2-arithmetic-t1a-w2-l1", eventType: "open", when: daysAgo(0) },
      { slug: "g2-healthandenvironment-t1a-w2-l1", eventType: "view", when: daysAgo(1) },
      { slug: "g2-arithmetic-t1a-w2-l2", eventType: "open", when: daysAgo(2) },
      { slug: "g2-healthandenvironment-t1a-w2-l2", eventType: "download", when: daysAgo(3) },
      { slug: "g2-arithmetic-t1a-w2-l3", eventType: "open", when: daysAgo(4) },
    ];
    const usageRows = usageSeeds
      .filter((r) => slugToId.has(r.slug))
      .map((r) => ({
        staffId,
        planId: slugToId.get(r.slug)!,
        eventType: r.eventType,
        occurredAt: r.when,
      }));

    if (usageRows.length > 0) {
      await db.insert(planUsageEvents).values(usageRows);
      usageInserted = usageRows.length;
    }
  }

  // --- Feedback: idempotent on (staff_id, plan_id). Only the first two used
  // plans are rated, leaving the others as unrated-but-used. ---
  const feedbackRows = [
    {
      slug: "g2-arithmetic-t1a-w2-l1",
      rating: 5,
      comment:
        "Losing the count on purpose worked brilliantly — the class argued for bundling before I suggested it.",
    },
    {
      slug: "g2-arithmetic-t1a-w2-l2",
      rating: 4,
      comment:
        "Good progression. I needed the number line for longer than the plan assumes; two pupils still jump at 159.",
    },
  ]
    .filter((r) => slugToId.has(r.slug))
    .map((r) => ({
      staffId,
      planId: slugToId.get(r.slug)!,
      rating: r.rating,
      comment: r.comment,
    }));

  let feedbackInserted = 0;
  if (feedbackRows.length > 0) {
    await db
      .insert(planFeedback)
      .values(feedbackRows)
      .onConflictDoNothing({
        target: [planFeedback.staffId, planFeedback.planId],
      });
    feedbackInserted = feedbackRows.length;
  }

  return { usageInserted, feedbackInserted };
}

/**
 * Seed the editable prompt parts from their Antoine-derived defaults.
 * Idempotent on the unique `key`, so re-running never clobbers admin edits.
 */
async function seedPromptParts(): Promise<number> {
  await db
    .insert(promptParts)
    .values(
      DEFAULT_PROMPT_PARTS.map((p) => ({
        key: p.key,
        label: p.label,
        content: p.content,
      })),
    )
    .onConflictDoNothing({ target: promptParts.key });
  return DEFAULT_PROMPT_PARTS.length;
}

async function main(): Promise<void> {
  const { driver } = await runMigrations();
  console.log(`[db:seed] migrations applied via ${driver} driver`);

  for (const member of DEMO_STAFF) {
    const row = await upsertStaffByEmail({ ...member });
    console.log(`[db:seed] upserted ${row.email} (${row.id})`);
  }

  const schemes = await seedSchemes();

  const planCount = await seedPlans(schemes);
  console.log(`[db:seed] seeded ${planCount} example lesson plans (idempotent)`);

  const promptPartCount = await seedPromptParts();
  console.log(`[db:seed] seeded ${promptPartCount} prompt parts (idempotent)`);

  const activity = await seedDemoActivity();
  console.log(
    `[db:seed] demo activity for ${DEMO_TEACHER_EMAIL}: ` +
      `usageInserted=${activity.usageInserted} feedbackInserted=${activity.feedbackInserted}`,
  );

  console.log(`[db:seed] done`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[db:seed] failed:", err);
    process.exit(1);
  });
