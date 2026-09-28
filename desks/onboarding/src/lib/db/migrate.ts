import "server-only";

/**
 * Programmatic migrator — applies the generated SQL migrations to whichever
 * driver is currently active.
 *
 *   - PGlite      → drizzle-orm/pglite/migrator
 *   - postgres-js → drizzle-orm/postgres-js/migrator using DATABASE_URL (owner)
 *
 * Request traffic may use DATABASE_PUBLIC_URL (least-privilege / RLS). Migrations
 * always use the owner DATABASE_URL so ALTER TABLE / CREATE POLICY succeed.
 *
 * Returns the active driver so callers/scripts can log what happened.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { db, getDbDriver, type PgliteDb } from "./client";
import * as schema from "./schema";

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
  const ownerUrl = process.env.DATABASE_URL?.trim();

  if (ownerUrl) {
    const sql = postgres(ownerUrl, { prepare: false, max: 1 });
    try {
      const ownerDb = drizzlePostgres(sql, { schema });
      await migratePostgres(ownerDb, { migrationsFolder: folder });
    } finally {
      await sql.end({ timeout: 5 });
    }
    return { driver: "postgres-js" };
  }

  if (getDbDriver() !== "pglite") {
    throw new Error("DATABASE_URL is required to migrate Postgres.");
  }

  await migratePglite(db as PgliteDb, { migrationsFolder: folder });
  return { driver: "pglite" };
}
