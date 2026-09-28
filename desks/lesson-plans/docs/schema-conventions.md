# Schema conventions

How tables, columns, and the bilingual content model are named in the
Silverleaf data layer (`src/lib/db/schema/`). Read this before adding a table.

## Naming

| Thing            | Rule                                              | Example                          |
| ---------------- | ------------------------------------------------- | -------------------------------- |
| Table name       | `snake_case`, **plural**                          | `staff`, `lesson_plans`          |
| Column name (DB) | `snake_case`                                      | `full_name`, `last_active_at`    |
| Field name (TS)  | `camelCase`, mapped to the DB name in `pgTable`   | `fullName: varchar("full_name")` |
| Primary key      | surrogate `id uuid` (`gen_random_uuid()`) …       | `staff.id`                       |
|                  | … **or** a composite PK for pure join/event rows  | `(member_id, role_id)`           |
| Foreign key col  | `<referenced_singular>_id`                        | `staff_id`                       |
| Timestamps       | `timestamptz`; `created_at` / `*_at` events       | `occurred_at`, `awarded_at`      |
| Index name       | `<table>_<cols>_idx`                              | `lesson_plans_subject_idx`       |
| Boolean          | positive phrasing, default provided               | `is_admin DEFAULT false`         |

Conventions in force in the current tables:

- **uuid PKs** default via `gen_random_uuid()` (built into the bundled
  PostgreSQL ≥ 14 and PGlite — no `pgcrypto` extension needed).
- **Foreign keys** that model ownership use `ON DELETE CASCADE` (deleting a
  staff member removes their progress rows). Declare with
  `.references(() => parent.id, { onDelete: "cascade" })`.
- **Event/junction tables** (no independent identity) use a **composite PK** of
  their natural key instead of a surrogate `id` — e.g. `member_roles` is keyed
  by `(member_id, role_id)`.
- **`varchar(n)` lengths** on `staff` are preserved exactly from the pre-Next
  Express app it was ported from (`email` 255, `campus` 100, `job_title` 150).
  New free-text-ish columns may use `text`.
- **`updated_at` maintains itself.** Declare it with
  `.defaultNow().$onUpdate(() => new Date())` — writers must NOT set it
  manually (only pass an explicit value when a specific timestamp is intended,
  e.g. one shared `now` across a batch).
- **Enum-ish `text` and `jsonb` columns are typed at the schema.** Export the
  TS union / payload type from the table's file and apply it with
  `.$type<...>()` (e.g. `PlanStatus`, `UsageEventType`, `string[]` for
  objectives/keywords). Call sites import these types — never re-declare them.
- Every table file exports inferred row types:
  `export type Staff = typeof staff.$inferSelect;` and a `New…` insert type.
- The schema **barrel** `src/lib/db/schema/index.ts` re-exports every table and
  is passed to Drizzle as `schema`. New tables MUST be re-exported there.

## Bilingual content pattern (EN / SW) — BINDING for future content tables

The app is bilingual: **English (`en`)** and **Swahili (`sw`)**. Every future
**content** table that holds human-readable copy MUST store both languages as
a **column pair** suffixed `_en` / `_sw`, rather than a separate translations
table or a JSON blob. This keeps queries flat, types exact, and makes the
EN-fallback trivial. (Today the only such columns are `roles.name_en/_sw`;
lesson-plan content itself is stored in the language it was authored in.)

Rules:

1. **Column pairs.** For each translatable field `foo`, define `foo_en` and
   `foo_sw`:

   ```ts
   title_en: varchar("title_en", { length: 255 }).notNull(),
   title_sw: varchar("title_sw", { length: 255 }),         // nullable
   description_en: text("description_en").notNull(),
   description_sw: text("description_sw"),                  // nullable
   ```

2. **English is the source of truth and is `NOT NULL`.** Swahili columns are
   **nullable** — content can ship in English first and be translated later.

3. **EN fallback.** When rendering in a locale, resolve a field as
   `value_<locale> ?? value_en`. Never show an empty string because a Swahili
   translation is missing; fall back to English. (A small helper belongs in the
   consuming feature, not in the schema; none exists yet because nothing
   renders `_sw` columns today.)

4. **Non-copy columns are not duplicated.** Only translatable *text* gets the
   `_en` / `_sw` treatment. Ids, ordering, flags, timestamps, foreign keys,
   media references, etc. stay single-column.

5. **Naming.** Suffixes are exactly `_en` and `_sw` (lowercase ISO-639-1). If a
   third language is ever added, it follows the same suffix rule
   (`_fr`, …) and the fallback chain is documented at that time.

## Dormant RBAC tables

`roles`, `member_roles`, and `item_role_visibility` (`src/lib/db/schema/roles.ts`)
**exist** in the schema and migrations but are a dormant scaffold — nothing
queries them yet; the app gates on `staff.is_admin`. Their default-open
visibility semantics are documented in the table file itself. Follow the
conventions above (including the EN/SW pattern) when bringing them — or any
new content table — to life.
