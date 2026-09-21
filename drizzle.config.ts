import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config — drives `db:generate` (diff schema → SQL) and
 * `db:migrate` / `db:studio` against a real Postgres.
 *
 * `db:generate` only reads the TypeScript schema and the existing migration
 * snapshots; it does NOT connect to a database, so the placeholder URL below is
 * fine when `DATABASE_URL` is unset. `db:studio` and any push DO connect and
 * therefore require a real `DATABASE_URL`.
 *
 * The embedded PGlite dev/test database is migrated programmatically instead —
 * see src/lib/db/migrate.ts and docs/data-layer.md.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/onboarding_hub_dev",
  },
  strict: true,
  verbose: true,
});
