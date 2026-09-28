/**
 * Vitest global setup — run once per worker process.
 *
 * Applies all Drizzle migrations to the in-memory PGlite instance that
 * client.ts creates when `NODE_ENV === 'test'`. Every test file in the same
 * worker process then operates against a fully-schemed embedded database
 * with no external dependencies.
 *
 * `NODE_ENV` is already set to "test" by Vitest before this file runs.
 */
import { runMigrations } from "@/lib/db";

await runMigrations();
