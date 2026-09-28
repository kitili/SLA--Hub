/**
 * App settings — admin-editable configuration values (AI Studio Settings tab).
 *
 * A keyed store, shaped like {@link ./promptParts prompt_parts}: one row per
 * setting, `key` is the stable business key so writes are upserts and a missing
 * row simply means "fall back to the built-in default" (there is no seed row).
 *
 * Values are opaque config strings (e.g. an OpenRouter model slug), NOT
 * human-readable copy — so the bilingual `_en`/`_sw` rule in
 * docs/schema-conventions.md does not apply here. Anything user-facing must not
 * be stored in this table.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staff } from "./staff";

/**
 * Every recognised setting key. Callers import this union rather than passing
 * bare strings, so a typo is a type error instead of a silently-ignored row.
 *
 * - `ai.generation_model` — OpenRouter slug used for lesson-plan generation.
 *   Resolved by `src/lib/ai/modelSetting.ts`, which falls back to AI_MODEL_ID.
 */
export type AppSettingKey = "ai.generation_model";

export const appSettings = pgTable("app_settings", {
  /** Surrogate primary key. Defaults via `gen_random_uuid()`. */
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /** Stable identifier. Unique business key. */
  key: text("key").notNull().unique().$type<AppSettingKey>(),
  /** The setting's value, as an opaque string. */
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
