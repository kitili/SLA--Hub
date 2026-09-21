import "server-only";

/**
 * Data layer entry point.
 *
 *   import { db, schema } from "@/lib/db";
 *   import { staffRepo, progressRepo } from "@/lib/db/repositories";
 *
 * `db` is a `server-only` singleton; importing this module from a Client
 * Component is a build error (by design).
 */
export { db, schema, getDbDriver, type Database } from "./client";
export { runMigrations } from "./migrate";
export * from "./repositories";
