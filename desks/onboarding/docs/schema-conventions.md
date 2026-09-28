# Schema conventions

How tables, columns, and the bilingual content model are named in the
Silverleaf data layer (`src/lib/db/schema/`). Read this before adding a table.

## Naming

| Thing            | Rule                                              | Example                          |
| ---------------- | ------------------------------------------------- | -------------------------------- |
| Table name       | `snake_case`, **plural**                          | `staff`, `document_reads`        |
| Column name (DB) | `snake_case`                                      | `full_name`, `last_active_at`    |
| Field name (TS)  | `camelCase`, mapped to the DB name in `pgTable`   | `fullName: varchar("full_name")` |
| Primary key      | surrogate `id uuid` (`gen_random_uuid()`) …       | `staff.id`                       |
|                  | … **or** a composite PK for pure join/event rows  | `(staff_id, item_id)`            |
| Foreign key col  | `<referenced_singular>_id`                        | `staff_id`                       |
| Timestamps       | `timestamptz`; `created_at` / `*_at` events       | `read_at`, `passed_at`           |
| Index name       | `idx_<table-or-area>_<column>`                    | `idx_staff_email`                |
| Boolean          | positive phrasing, default provided               | `is_admin DEFAULT false`         |

Conventions in force in the current tables:

- **uuid PKs** default via `gen_random_uuid()` (built into the bundled
  PostgreSQL ≥ 14 and PGlite — no `pgcrypto` extension needed).
- **Foreign keys** that model ownership use `ON DELETE CASCADE` (deleting a
  staff member removes their progress rows). Declare with
  `.references(() => parent.id, { onDelete: "cascade" })`.
- **Event/junction tables** (no independent identity) use a **composite PK** of
  their natural key instead of a surrogate `id` — e.g. `document_reads` is keyed
  by `(staff_id, item_id)`.
- **`varchar(n)` lengths** are preserved exactly from the legacy SQL where a
  table was ported (`email` 255, `campus` 100, `job_title` 150, item/checkpoint
  ids 50). New free-text-ish columns may use `text`.
- Every table file exports inferred row types:
  `export type Staff = typeof staff.$inferSelect;` and a `New…` insert type.
- The schema **barrel** `src/lib/db/schema/index.ts` re-exports every table and
  is passed to Drizzle as `schema`. New tables MUST be re-exported there.

## Bilingual content pattern (EN / SW) — BINDING for future content tables

Onboarding content is bilingual: **English (`en`)** and **Swahili (`sw`)**.
Every future **content** table that holds human-readable copy MUST store both
languages as a **column pair** suffixed `_en` / `_sw`, rather than a separate
translations table or a JSON blob. This keeps queries flat, types exact, and
makes the EN-fallback trivial.

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
   translation is missing; fall back to English. (A small helper, e.g.
   `pickLocale(row, "title", locale)`, belongs in the i18n/content layer, not in
   the schema.)

4. **Non-copy columns are not duplicated.** Only translatable *text* gets the
   `_en` / `_sw` treatment. Ids, ordering, flags, timestamps, foreign keys,
   media references, etc. stay single-column.

5. **Naming.** Suffixes are exactly `_en` and `_sw` (lowercase ISO-639-1). If a
   third language is ever added, it follows the same suffix rule
   (`_fr`, …) and the fallback chain is documented at that time.

## Reserved future table names

These names are **reserved** for upcoming content/quiz/RBAC/versioning work.
They are **not real tables yet** — do not create them here. They are listed so
nobody squats the names, picks conflicting plurals, or invents a parallel
concept. When implemented they MUST follow the conventions above (and the
EN/SW pattern for any copy they store).

| Reserved table         | Intended purpose (sketch)                                        |
| ---------------------- | ---------------------------------------------------------------- |
| `sections`             | Top-level onboarding sections (ordered). Bilingual title/intro.  |
| `section_items`        | Items within a section (documents/videos). Bilingual title.      |
| `quizzes`              | A checkpoint quiz attached to a section.                         |
| `quiz_questions`       | Questions in a quiz. Bilingual prompt.                           |
| `quiz_options`         | Answer options per question. Bilingual label; `is_correct`.      |
| `quiz_attempts`        | A staff member's attempt at a quiz (score, passed, timestamps).  |
| `item_progress`        | Generalized per-item progress (supersedes `document_reads`).     |
| `member_profiles`      | Extended per-staff profile data beyond the core `staff` row.     |
| `signoffs`             | Formal acknowledgements / sign-offs of policies.                 |
| `content_versions`     | Versioning/audit of content edits.                               |
| `roles`                | RBAC roles.                                                      |
| `member_roles`         | Staff ↔ role assignments (join).                                 |
| `item_role_visibility` | Which roles can see which items (join + visibility rules).       |

> The `materials` table already exists (file metadata). Its `owner_item_id` is a
> **soft** reference to a future `section_items.id`; it is intentionally **not** a
> DB foreign key yet because the content tree is still file-based.
