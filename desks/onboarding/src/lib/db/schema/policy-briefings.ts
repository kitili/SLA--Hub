/**
 * Policy briefing drafts — AI (or extractive) scripts generated from the
 * official policy PDF/DOCX. Members only see a row after an admin publishes it.
 */
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sectionItems } from "./content";
import { materials } from "./materials";
import { staff } from "./staff";

type StoredBriefingScript = {
  title: string;
  intro: string;
  chapters: { heading: string; body: string }[];
  close: string;
  nextStep: string;
};

export const POLICY_BRIEFING_STATUSES = [
  "generating",
  "draft",
  "published",
  "failed",
] as const;

export type PolicyBriefingStatus = (typeof POLICY_BRIEFING_STATUSES)[number];

export const policyBriefings = pgTable(
  "policy_briefings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sectionItemId: varchar("section_item_id", { length: 50 })
      .notNull()
      .references(() => sectionItems.id, { onDelete: "cascade" }),
    sourceMaterialId: uuid("source_material_id").references(() => materials.id, {
      onDelete: "set null",
    }),
    sourceFilename: varchar("source_filename", { length: 255 }),
    sourceHash: varchar("source_hash", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("generating"),
    generator: varchar("generator", { length: 20 }),
    errorMessage: text("error_message"),
    scriptEn: jsonb("script_en")
      .$type<StoredBriefingScript>()
      .notNull()
      .default(sql`'{"title":"","intro":"","chapters":[],"close":"","nextStep":""}'::jsonb`),
    scriptSw: jsonb("script_sw").$type<StoredBriefingScript | null>(),
    createdBy: uuid("created_by").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_policy_briefings_item").on(table.sectionItemId),
    index("idx_policy_briefings_item_status").on(
      table.sectionItemId,
      table.status,
    ),
  ],
);

export type PolicyBriefingRow = typeof policyBriefings.$inferSelect;
export type NewPolicyBriefingRow = typeof policyBriefings.$inferInsert;
