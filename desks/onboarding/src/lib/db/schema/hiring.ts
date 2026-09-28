/**
 * HR hiring pipeline — candidate-centric board (0011) plus deprecated
 * job-openings tables from migration 0010 (unused in UI; kept for DB compat).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const jobOpenings = pgTable(
  "job_openings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 200 }).notNull(),
    roleTrack: varchar("role_track", { length: 50 }).notNull(),
    campus: varchar("campus", { length: 150 }),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdById: uuid("created_by_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_job_openings_status").on(table.status),
    index("idx_job_openings_role_track").on(table.roleTrack),
  ],
);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    jobOpeningId: uuid("job_opening_id")
      .notNull()
      .references(() => jobOpenings.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    stage: varchar("stage", { length: 30 }).notNull().default("applied"),
    internalNotes: text("internal_notes"),
    /** Filled by HR after manually creating the ed-admin account. */
    edAdminStaffId: varchar("ed_admin_staff_id", { length: 64 }),
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_job_applications_job").on(table.jobOpeningId),
    index("idx_job_applications_stage").on(table.stage),
    index("idx_job_applications_email").on(table.email),
  ],
);

export type JobOpening = typeof jobOpenings.$inferSelect;
export type NewJobOpening = typeof jobOpenings.$inferInsert;
export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;

/** Reusable performance task templates managed by HR. */
export const hiringPerformanceTasks = pgTable("hiring_performance_tasks", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileLink: text("file_link"),
  managerEmail: varchar("manager_email", { length: 254 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HiringPerformanceTask = typeof hiringPerformanceTasks.$inferSelect;
export type NewHiringPerformanceTask =
  typeof hiringPerformanceTasks.$inferInsert;

/** Candidate-centric pipeline (SILVERLEAF_HIRING parity). */
export const hiringCandidates = pgTable(
  "hiring_candidates",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    preferredEmail: varchar("preferred_email", { length: 254 }),
    linkedin: text("linkedin"),
    cvLink: text("cv_link"),
    roleApplied: varchar("role_applied", { length: 255 })
      .notNull()
      .default("General"),
    applicationCheck: varchar("application_check", { length: 64 })
      .notNull()
      .default("OK"),
    stage: varchar("stage", { length: 64 }).notNull().default("new"),
    cultureMarker: varchar("culture_marker", { length: 8 }),
    cultureVideoLink: text("culture_video_link"),
    cultureVideoFeedback: text("culture_video_feedback"),
    cultureToken: varchar("culture_token", { length: 64 }),
    performanceMarker: varchar("performance_marker", { length: 8 }),
    performanceTaskSentAt: timestamp("performance_task_sent_at", {
      withTimezone: true,
    }),
    performanceTaskLink: text("performance_task_link"),
    performanceTaskSubmitted: text("performance_task_submitted"),
    performanceToken: varchar("performance_token", { length: 64 }),
    performanceTaskId: uuid("performance_task_id").references(
      () => hiringPerformanceTasks.id,
      { onDelete: "set null" },
    ),
    performanceManagerEmail: varchar("performance_manager_email", {
      length: 254,
    }),
    notes: text("notes"),
    // IT onboarding flow (triggered when candidate is hired)
    itOnboardingToken: varchar("it_onboarding_token", { length: 64 }),
    itOnboardingExpiresAt: timestamp("it_onboarding_expires_at", {
      withTimezone: true,
    }),
    workEmail: varchar("work_email", { length: 254 }),
    itSubmittedAt: timestamp("it_submitted_at", { withTimezone: true }),
    welcomeEmailSentAt: timestamp("welcome_email_sent_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("idx_hiring_candidates_stage").on(table.stage),
    index("idx_hiring_candidates_created_at").on(table.createdAt),
    index("idx_hiring_candidates_email").on(table.email),
  ],
);

export const hiringPipelineEvents = pgTable(
  "hiring_pipeline_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => hiringCandidates.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 32 }).notNull(),
    actorId: uuid("actor_id"),
    detail: text("detail"),
    emailTo: varchar("email_to", { length: 254 }),
    emailSubject: varchar("email_subject", { length: 500 }),
    success: boolean("success").notNull().default(true),
  },
  (table) => [
    index("idx_hiring_pipeline_events_candidate").on(
      table.candidateId,
      table.createdAt,
    ),
  ],
);

export type HiringCandidate = typeof hiringCandidates.$inferSelect;
export type NewHiringCandidate = typeof hiringCandidates.$inferInsert;
export type HiringPipelineEvent = typeof hiringPipelineEvents.$inferSelect;
