/**
 * CLI: seed the active database (idempotent).
 *
 *   npm run db:seed
 *
 * Runs migrations first, then:
 *   1. loads the 12 onboarding sections + items and the 12 section quizzes from
 *      the legacy data files into the new content/quiz tables (see
 *      src/lib/db/seed.ts), and ensures one initial content_versions row, and
 *   2. upserts a couple of demo staff rows by email (handy for local dev).
 *
 * Safe to run repeatedly; intended for local PGlite dev and harmless against an
 * empty Postgres too.
 */
import { runMigrations } from "../migrate";
import { seedContent } from "../seed";
import { upsertStaffByEmail } from "../repositories/staff";

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

async function main(): Promise<void> {
  const { driver } = await runMigrations();
  console.log(`[db:seed] migrations applied via ${driver} driver`);

  const content = await seedContent();
  console.log(
    `[db:seed] content: ${content.sections} sections, ${content.items} items, ` +
      `${content.quizzes} quizzes (${content.questions} questions, ` +
      `${content.options} options), ${content.materials} material refs` +
      (content.contentVersionEnsured ? ", + initial content version" : ""),
  );

  for (const member of DEMO_STAFF) {
    const row = await upsertStaffByEmail({ ...member });
    console.log(`[db:seed] upserted ${row.email} (${row.id})`);
  }

  console.log(`[db:seed] done`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[db:seed] failed:", err);
    process.exit(1);
  });
