import "server-only";

/**
 * Drizzle database client — dual driver, chosen at runtime.
 *
 *   - If `DATABASE_URL` is set  → postgres-js (real PostgreSQL: Vercel Postgres
 *     / Neon in preview & production, or a local Postgres in dev).
 *   - Otherwise                → PGlite (embedded Postgres) for local dev and
 *     tests. Persists to `.pglite/` for dev so data survives restarts, and runs
 *     in-memory for tests (`NODE_ENV === 'test'`) or when `PGLITE_MEMORY=1`.
 *
 * This module is `server-only`: importing it from a Client Component is a build
 * error. It reads `process.env` directly (no dependency on the env module) so
 * the data layer stays self-contained.
 *
 * A single instance is cached on `globalThis` so Next.js dev HMR and serverless
 * warm invocations reuse one driver/pool instead of leaking connections.
 */
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

import * as schema from "./schema";

export { schema };

/** Where PGlite persists its data dir for local dev (gitignored). */
export const PGLITE_DATA_DIR = ".pglite";

export type PgliteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type PostgresDb = ReturnType<typeof drizzlePostgres<typeof schema>>;

/**
 * The active database handle. Typed as the union of both drivers; every method
 * used by the repositories (select/insert/update/delete/transaction) exists on
 * both, so callers never branch on the driver.
 */
export type Database = PgliteDb | PostgresDb;

interface DbSingleton {
  db: Database;
  /** The PGlite client, present only when the embedded driver is active. */
  pglite?: PGlite;
  /** The postgres-js client, present only when that driver is active. */
  sql?: ReturnType<typeof postgres>;
  driver: "pglite" | "postgres-js";
}

// Cache across module reloads (HMR) and warm serverless invocations.
const globalForDb = globalThis as unknown as {
  __silverleafDb__?: DbSingleton;
};

function pgliteDataDir(): string {
  const inMemory =
    process.env.NODE_ENV === "test" || process.env.PGLITE_MEMORY === "1";
  return inMemory ? "memory://" : PGLITE_DATA_DIR;
}

function createSingleton(): DbSingleton {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Real Postgres. `prepare: false` is the safe default for transaction-mode
    // poolers (e.g. PgBouncer / Vercel Postgres) which reject prepared stmts.
    const sql = postgres(databaseUrl, { prepare: false });
    const db = drizzlePostgres(sql, { schema });
    return { db, sql, driver: "postgres-js" };
  }

  const pglite = new PGlite(pgliteDataDir());
  const db = drizzlePglite(pglite, { schema });
  return { db, pglite, driver: "pglite" };
}

function getSingleton(): DbSingleton {
  if (!globalForDb.__silverleafDb__) {
    globalForDb.__silverleafDb__ = createSingleton();
  }
  return globalForDb.__silverleafDb__;
}

/**
 * The active Drizzle database instance — a LAZY proxy. The underlying driver
 * (PGlite or postgres-js) is created on FIRST use, never at module load, so
 * importing this module during a Next.js build (page bundling / prerender)
 * never spins up PGlite — which aborts inside the build worker. At runtime the
 * first query materialises the singleton; thereafter it is reused.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getSingleton().db as unknown as Record<
      string | symbol,
      unknown
    >;
    const value = real[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
}) as Database;

/** Which driver is active. Lazily resolved — does not initialise at import. */
export function getDbDriver(): "pglite" | "postgres-js" {
  return getSingleton().driver;
}
