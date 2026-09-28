import "server-only";

/**
 * Programmatic migrator — applies the generated SQL migrations to whichever
 * driver is currently active.
 *
 *   - PGlite      → drizzle-orm/pglite/migrator
 *   - postgres-js → drizzle-orm/postgres-js/migrator
 *
 * This is the ONLY place schema gets applied to the embedded database. For real
 * Postgres in CI/Vercel the migrations are applied at deploy time via the
 * `db:migrate` script (see docs/data-layer.md) — never at request time.
 *
 * Returns the active driver so callers/scripts can log what happened.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";

import { db, getDbDriver, type PgliteDb, type PostgresDb } from "./client";

/** Absolute path to the generated migrations folder (sibling of this file). */
function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "migrations");
}

/**
 * Apply all pending migrations to the active database.
 *
 * @param migrationsFolderOverride optional folder (used by the seed/smoke
 *   scripts which may run from a different cwd); defaults to the bundled
 *   `migrations` directory.
 */
export async function runMigrations(
  migrationsFolderOverride?: string,
): Promise<{ driver: "pglite" | "postgres-js" }> {
  const folder = migrationsFolderOverride ?? migrationsFolder();
  const driver = getDbDriver();

  if (driver === "pglite") {
    await migratePglite(db as PgliteDb, { migrationsFolder: folder });
  } else {
    await migratePostgres(db as PostgresDb, { migrationsFolder: folder });
  }

  return { driver };
}
