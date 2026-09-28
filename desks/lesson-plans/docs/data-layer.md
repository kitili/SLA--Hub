# Data layer

Drizzle ORM over a **dual driver** and a deploy-time migration story. Server
code imports `db` and the Drizzle builders directly (repositories exist only
for shared areas — see below). Everything here is **server-only** — importing
any of it from a Client Component is a build error by design.

```
src/lib/db/
  client.ts            # the `db` singleton + dual driver selection
  schema/              # tables (source of truth) + barrel index.ts
  migrations/          # generated SQL + meta (drizzle-kit)
  migrate.ts           # programmatic migrator (picks driver)
  repositories/        # shared typed data ops (staffRepo only today)
  scripts/             # db:migrate / db:seed / db:import / db:import-textbooks
                       # runners (+ the TS resolver hook behind `db:run`)
src/lib/storage/       # file storage adapters (see docs/materials.md)
drizzle.config.ts      # drizzle-kit config (generate / studio)
```

## Driver selection (runtime)

`src/lib/db/client.ts` chooses the driver from the environment **once** and
caches the instance on `globalThis` (so Next.js dev HMR and warm serverless
invocations reuse one pool):

| Condition                                   | Driver                            | Storage                          |
| ------------------------------------------- | --------------------------------- | -------------------------------- |
| `DATABASE_URL` is set                       | **postgres-js** (`postgres`)      | real PostgreSQL (Vercel/Neon)    |
| `DATABASE_URL` unset                        | **PGlite** (embedded Postgres)    | `.pglite/` dir (gitignored)      |
| `DATABASE_URL` unset + test / `PGLITE_MEMORY=1` | **PGlite**                    | in-memory (`memory://`)          |

The exported `db` is typed as the **union** of both driver databases; every
method the repositories use (`select` / `insert` / `update` / `delete` /
`onConflictDoUpdate`) exists on both, so **callers never branch on the driver**.

`client.ts` reads `process.env.DATABASE_URL` directly — it does not depend on any
env-validation module, keeping the data layer self-contained. For real Postgres
the client sets `prepare: false`, which is the safe default for transaction-mode
poolers (PgBouncer / Vercel Postgres) that reject prepared statements.

### Why PGlite for local/dev

No Docker, no local Postgres install, no network: `npm run dev` just works, and
tests get a fresh in-memory database. Production still runs real PostgreSQL, and
because both go through the same Drizzle schema + migrations, the SQL is
identical.

> **PGlite is single-connection.** The `.pglite/` data dir can only be held by
> ONE process at a time. **Never run `db:*` scripts while `next dev` is
> running** — the second process wedges the first and sign-in/writes hang until
> both are stopped. Stop the dev server, run the script, restart. (Tests are
> unaffected: they use in-memory PGlite, one per vitest worker.)

## Migrations

Migrations are **generated** from the TypeScript schema and committed as SQL.
They are applied two different ways depending on the environment, but **never at
request time**.

### Generate (developer machine)

```bash
npm run db:generate     # drizzle-kit generate → src/lib/db/migrations/*.sql
```

`db:generate` only reads the schema + existing migration snapshots; it does not
connect to a database. Commit the generated `.sql` and `meta/` files.

### Apply — local / embedded (PGlite)

```bash
npm run db:migrate      # programmatic migrator against the active driver
npm run db:seed         # migrate + insert idempotent demo data
```

These run `src/lib/db/migrate.ts` → `runMigrations()`, which picks
`drizzle-orm/pglite/migrator` or `drizzle-orm/postgres-js/migrator` based on the
active driver and applies everything in `src/lib/db/migrations/`.

### Apply — preview / production (real Postgres) = DEPLOY TIME

Run the migrations **as an explicit deploy-time step**, before the app starts
serving — **not** lazily on the first request:

```bash
DATABASE_URL=… npm run db:migrate
```

This is deliberately a **manual** step: migrations never run automatically on
deploy (see DEPLOYMENT.md §4). Wiring `db:migrate` into the Vercel build
command (`npm run db:migrate && npm run build`) would automate it, but is
discouraged — the build would then need (and could mutate) the production
database, and a failed migration would block every deploy. Rationale for
keeping DDL out of request time:

- **No DDL at request time.** Request handlers must assume the schema already
  exists. Applying migrations inside a serverless function is racy (many cold
  starts), slow (adds latency to a user request), and can partially apply under
  concurrency. The programmatic migrator is for the embedded dev DB and for the
  explicit deploy step — request code only ever runs DML.
- Drizzle records applied migrations in `__drizzle_migrations`, so re-running is
  safe and idempotent.

> The runner scripts execute TypeScript directly via Node's
> `--experimental-strip-types`. Because the source uses Next.js bundler-style
> imports (the `@/` alias and extensionless specifiers), the scripts register a
> tiny dependency-free ESM resolve hook (`scripts/ts-resolve*.mjs`) and run with
> `--conditions=react-server` so the `server-only` marker resolves to its no-op
> build. All db scripts share one `db:run` npm script that carries this
> incantation; `db:migrate` / `db:seed` / `db:import` / `db:import-textbooks`
> delegate to it. No extra dev dependency (no `tsx`/`ts-node`) is required.

### drizzle-kit studio (optional)

```bash
DATABASE_URL=… npm run db:studio
```

Studio connects to a **real** Postgres (it needs a live `DATABASE_URL`); it is
not used against the embedded PGlite database.

## Repositories

Server actions and queries import `db` from `@/lib/db` and use the Drizzle
query builders directly — that is the prevailing convention in this app. A
repository module is only extracted when the same data operations are shared
across several call sites; **staff** is the one such area today:

```ts
import { staffRepo } from "@/lib/db/repositories";

const staff = await staffRepo.findStaffByEmail(email);
```

Business policy stays out of repositories (e.g. the HR-admin email check is
passed *in* as `isAdmin` rather than baked into the repo).

For everything else, the pattern is a **`server-only` query module** owned by
its feature (e.g. `src/lib/points.ts`, `src/lib/feedback-queries.ts`,
`src/lib/search/lessonSearch.ts`) or inline queries in the server action that
needs them. Reach for the `sql` template only when a builder can't express the
query.

### Recipe: add a table (+ repository, if shared)

1. **Schema first.** Add/append the table in `src/lib/db/schema/<area>.ts`
   following `docs/schema-conventions.md`, export its `$inferSelect` /
   `$inferInsert` types, and re-export it from `schema/index.ts`.
2. **Generate + review** the migration: `npm run db:generate`, then read the
   emitted SQL in `src/lib/db/migrations/` before committing.
3. **Create `src/lib/db/repositories/<area>.ts`** — only when the same data
   ops are shared across several call sites; otherwise query from the feature's
   own module and skip steps 3–5. Start the file with `import "server-only";`.
   Import `db` from `../client` and the table(s) from `../schema`.
4. **Export typed functions only.** No `db`/SQL types in the public signature —
   accept/return domain values and the inferred row types. Use Drizzle query
   builders (`eq`, `and`, `inArray`, `desc`, `count`, `onConflictDoUpdate`, …);
   reach for the `sql` template only when a builder can't express it, and keep it
   inside the repository.
5. **Re-export** the module as a namespace from
   `src/lib/db/repositories/index.ts`:
   `export * as <area>Repo from "./<area>";`.
6. **Verify:** `npm run typecheck && npm run lint`, and exercise it against the
   embedded DB (`npm run db:migrate` then a quick script) if behavior is
   non-trivial.
