/**
 * Prompt parts — the editable building blocks of the generation prompt
 * (AI Studio v2).
 *
 * One row per part (`system`, `rules`, `blueprint`, `schema_note`,
 * `task_template`), seeded from the Antoine prompting
 * guide. The admin edits these in the Studio; `buildPrompt` assembles them in a
 * fixed order with the per-request inputs. Keyed by a stable `key` so updates
 * are upserts and a "reset to default" can restore the seed.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const promptParts = pgTable("prompt_parts", {
  /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /**
   * Stable identifier: system | rules | blueprint | schema_note |
   * task_template. Unique business key.
   */
  key: text("key").notNull().unique(),
  /** Human label for the editor UI. */
  label: text("label").notNull(),
  /** The editable prompt text for this part. */
  content: text("content").notNull(),
  updatedBy: uuid("updated_by").references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PromptPart = typeof promptParts.$inferSelect;
export type NewPromptPart = typeof promptParts.$inferInsert;
