/**
 * CLI: delete the embedded PGlite data directory. First half of `db:reset`,
 * which then re-runs migrate + seed.
 *
 *   npm run db:reset
 *
 * Why this exists: every insert in `seed.ts` is `onConflictDoNothing`, so it
 * never UPDATES a row that already exists. After editing the sample corpus,
 * re-running `db:seed` silently changes nothing and gives no warning — dropping
 * the database is the only way to see the edits locally.
 *
 * PGlite only, deliberately: it refuses to run when `DATABASE_URL` is set,
 * because the equivalent against a real Postgres would destroy real data.
 *
 * PGlite is single-connection — stop `next dev` first, or this races the dev
 * server's open handle on `.pglite/` (see CLAUDE.md).
 */
import { rm, stat } from "node:fs/promises";
import path from "node:path";

import { PGLITE_DATA_DIR } from "../client";

async function main(): Promise<void> {
  if (process.env.DATABASE_URL) {
    console.error(
      "[db:reset] refusing to run: DATABASE_URL is set, so the active database is a real " +
        "Postgres.\n" +
        "[db:reset] This command only rebuilds the embedded PGlite dev database. To reset a " +
        "real database, drop it yourself and run db:migrate && db:seed.",
    );
    process.exit(1);
  }

  const dir = path.join(process.cwd(), PGLITE_DATA_DIR);
  const existed = await stat(dir).then(
    () => true,
    () => false,
  );
  await rm(dir, { recursive: true, force: true });

  console.log(
    existed
      ? `[db:reset] removed ${PGLITE_DATA_DIR}/`
      : `[db:reset] no ${PGLITE_DATA_DIR}/ to remove`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[db:reset] failed:", err);
    process.exit(1);
  });
