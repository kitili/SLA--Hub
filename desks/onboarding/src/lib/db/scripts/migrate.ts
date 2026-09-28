/**
 * CLI: apply pending migrations to the active database.
 *
 *   npm run db:migrate
 *
 * Uses the programmatic migrator (src/lib/db/migrate.ts), which picks the
 * PGlite or postgres-js migrator based on whether DATABASE_URL is set. See
 * docs/data-layer.md for the deploy-time strategy.
 */
import { runMigrations } from "../migrate";

async function main(): Promise<void> {
  const { driver } = await runMigrations();
  console.log(`[db:migrate] migrations applied via ${driver} driver`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[db:migrate] failed:", err);
    console.error(
      "[db:migrate] hint: stop `npm run dev`, then run `npm run db:reset` and start dev again.",
    );
    process.exit(1);
  });
