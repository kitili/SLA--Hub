/**
 * Bio-data schema (M5) — extended, PII-bearing staff profile.
 *
 * New in Wave 3. Modeled from docs/bio-fields.md (itself derived from the
 * Silverleaf Recruitment Bio-Data form). One flat `member_profiles` row per
 * staff member (1:1, UNIQUE on `member_id`) plus the repeating child tables.
 *
 * IMPORTANT design choices (all deliberate, see docs/bio-fields.md §5):
 *   - These are **user data** columns, NOT translatable content, so they do
 *     **not** use the `*_en` / `*_sw` pattern.
 *   - NOTHING is `NOT NULL` except the surrogate PK and the owning FK — the doc
 *     mandates that required-ness is enforced in validation later, and draft /
 *     partial-save must be possible.
 *   - Yes/No form fields (`has_disabilities`, `arrest_record`,
 *     `misconduct_record`) are stored as nullable booleans (notes §5.7/§5.8).
 *   - The stale computed `age` column is intentionally dropped (note §5.2); age
 *     is derived from `date_of_birth` on read.
 *   - `certification_name` is persisted (note §5.1, recommended).
 *   - `qualification.document_ref` is omitted (note §5.16, always NULL in source).
 *
 * snake_case columns throughout; camelCase Drizzle fields mapped to them.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

/* ------------------------------------------------------------------ */
/* Flat profile (1:1 with staff)                                       */
/* ------------------------------------------------------------------ */

/** One extended bio-data row per staff member. PII-bearing. */
export const memberProfiles = pgTable(
  "member_profiles",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** 1:1 with staff — UNIQUE. ON DELETE CASCADE with the staff row. */
    memberId: uuid("member_id")
      .notNull()
      .unique()
      .references(() => staff.id, { onDelete: "cascade" }),

    // -- Personal (§2.1)
    surname: varchar("surname", { length: 100 }),
    firstName: varchar("first_name", { length: 100 }),
    middleName: varchar("middle_name", { length: 100 }),
    otherNames: varchar("other_names", { length: 255 }),
    maidenName: varchar("maiden_name", { length: 100 }),
    /** Enum (app-level): MALE, FEMALE. */
    gender: varchar("gender", { length: 50 }),
    /** Enum (app-level): Single, Married, Divorced, Widowed, Separated. */
    maritalStatus: varchar("marital_status", { length: 50 }),
    dateOfBirth: date("date_of_birth"),
    placeOfBirth: varchar("place_of_birth", { length: 150 }),
    nationality: varchar("nationality", { length: 100 }),
    hasDisabilities: boolean("has_disabilities"),
    disabilitiesDetails: text("disabilities_details"),

    // -- Contact (§2.2)
    homePhone: text("home_phone"),
    mobilePhone: text("mobile_phone"),
    email: varchar("email", { length: 255 }),
    residentialAddress: text("residential_address"),

    // -- Identification documents (§2.3)
    identificationNo: text("identification_no"),
    idPlaceOfIssue: varchar("id_place_of_issue", { length: 150 }),
    idExpiryDate: date("id_expiry_date"),
    drivingPermitNo: text("driving_permit_no"),
    drivingPlaceOfIssue: varchar("driving_place_of_issue", { length: 150 }),
    drivingExpiryDate: date("driving_expiry_date"),
    nssfNo: text("nssf_no"),
    tinNo: text("tin_no"),
    nhifNo: text("nhif_no"),

    // -- Employment (§2.4)
    position: varchar("position", { length: 150 }),
    workStation: varchar("work_station", { length: 150 }),

    // -- Banking (§2.5)
    bankName: varchar("bank_name", { length: 100 }),
    accountName: varchar("account_name", { length: 255 }),
    accountNumber: text("account_number"),
    mobileMoneyNumber: text("mobile_money_number"),

    // -- Legal & conduct (§2.7)
    arrestRecord: boolean("arrest_record"),
    arrestDetails: text("arrest_details"),
    misconductRecord: boolean("misconduct_record"),
    misconductDetails: text("misconduct_details"),

    // -- Certification / declaration (§2.8)
    certificationName: varchar("certification_name", { length: 255 }),
    certificationDate: date("certification_date"),

    // -- DSGVO / GDPR consent (Wave 5A)
    // Explicit, recorded consent for processing this PII for employment &
    // onboarding (GDPR Art. 6(1)(a) / Art. 7). Nullable: a draft profile may
    // exist before consent is captured, but the server action requires consent
    // before any data is persisted. `consentVersion` lets us re-prompt if the
    // privacy notice wording changes.
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    consentVersion: text("consent_version"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_member_profiles_member").on(table.memberId)],
);

/* ------------------------------------------------------------------ */
/* Child tables (1:many)                                               */
/* ------------------------------------------------------------------ */

/**
 * Shared FK column factory: every child table references
 * member_profiles(id) NOT NULL with ON DELETE CASCADE.
 */
function profileFk() {
  return uuid("member_profile_id")
    .notNull()
    .references(() => memberProfiles.id, { onDelete: "cascade" });
}

/** Uploaded document references (§4.2 member_documents). 6 document types. */
export const memberDocuments = pgTable(
  "member_documents",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    /**
     * 'Passport Photo' | 'Curriculum Vitae' | 'National ID' |
     * 'Birth Certificate' | 'Professional Certificate' | 'Academic Certificate'
     */
    documentType: varchar("document_type", { length: 100 }),
    filePath: varchar("file_path", { length: 500 }),
    originalName: varchar("original_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }),
    fileSizeBytes: integer("file_size_bytes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_member_documents_profile").on(table.memberProfileId)],
);

/** Spouse — at most one per profile (UNIQUE on member_profile_id). (§3.1) */
export const memberSpouses = pgTable("member_spouses", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  memberProfileId: uuid("member_profile_id")
    .notNull()
    .unique()
    .references(() => memberProfiles.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }),
  phone: text("phone"),
  occupation: varchar("occupation", { length: 150 }),
  employer: varchar("employer", { length: 255 }),
});

/** Biological children — unlimited per profile. (§3.2) */
export const memberChildren = pgTable(
  "member_children",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    fullNames: varchar("full_names", { length: 255 }),
    dateOfBirth: date("date_of_birth"),
    /** Enum (app-level): MALE, FEMALE, Other. */
    gender: varchar("gender", { length: 50 }),
    schoolEmployer: varchar("school_employer", { length: 255 }),
    contactNumber: text("contact_number"),
  },
  (table) => [index("idx_member_children_profile").on(table.memberProfileId)],
);

/** Family contacts — parents, siblings, guardians. (§3.3) */
export const memberFamilyContacts = pgTable(
  "member_family_contacts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    /** Enum (app-level): Father, Mother, Brother, Sister, Guardian. */
    relationship: varchar("relationship", { length: 50 }),
    fullName: varchar("full_name", { length: 255 }),
    phone: text("phone"),
    address: text("address"),
    occupation: varchar("occupation", { length: 150 }),
  },
  (table) => [
    index("idx_member_family_contacts_profile").on(table.memberProfileId),
  ],
);

/** Emergency contacts — unlimited; free-text relationship. (§3.4) */
export const memberEmergencyContacts = pgTable(
  "member_emergency_contacts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    fullName: varchar("full_name", { length: 255 }),
    relationship: varchar("relationship", { length: 100 }),
    phone: text("phone"),
    address: text("address"),
    /** Enum (app-level): Primary, Secondary. */
    priority: varchar("priority", { length: 20 }),
  },
  (table) => [
    index("idx_member_emergency_contacts_profile").on(table.memberProfileId),
  ],
);

/** Relatives already employed at Silverleaf (nepotism disclosure). (§3.5) */
export const memberRelativesEmployed = pgTable(
  "member_relatives_employed",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    fullName: varchar("full_name", { length: 255 }),
    relationship: varchar("relationship", { length: 100 }),
    position: varchar("position", { length: 150 }),
    workStation: varchar("work_station", { length: 150 }),
  },
  (table) => [
    index("idx_member_relatives_employed_profile").on(table.memberProfileId),
  ],
);

/** Academic & professional qualifications. (§3.6) */
export const memberQualifications = pgTable(
  "member_qualifications",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    /** Enum (app-level): Certificate, Diploma, Degree, Masters, PhD. */
    level: varchar("level", { length: 100 }),
    qualification: varchar("qualification", { length: 255 }),
    institution: varchar("institution", { length: 255 }),
    yearObtained: integer("year_obtained"),
  },
  (table) => [
    index("idx_member_qualifications_profile").on(table.memberProfileId),
  ],
);

/** Previous employment history. (§3.7) */
export const memberEmploymentHistory = pgTable(
  "member_employment_history",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    employer: varchar("employer", { length: 255 }),
    position: varchar("position", { length: 150 }),
    dateFrom: date("date_from"),
    /** null = current / present. */
    dateTo: date("date_to"),
    leavingReason: text("leaving_reason"),
  },
  (table) => [
    index("idx_member_employment_history_profile").on(table.memberProfileId),
  ],
);

/** Referees — designed as exactly 3 (reference_order 1–3). (§3.8) */
export const memberReferences = pgTable(
  "member_references",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    memberProfileId: profileFk(),
    referenceOrder: integer("reference_order"),
    fullName: varchar("full_name", { length: 255 }),
    relationship: varchar("relationship", { length: 100 }),
    phone: text("phone"),
    email: varchar("email", { length: 255 }),
    organization: varchar("organization", { length: 255 }),
  },
  (table) => [
    index("idx_member_references_profile").on(table.memberProfileId),
  ],
);

export type MemberProfile = typeof memberProfiles.$inferSelect;
export type NewMemberProfile = typeof memberProfiles.$inferInsert;
export type MemberDocument = typeof memberDocuments.$inferSelect;
export type NewMemberDocument = typeof memberDocuments.$inferInsert;
export type MemberSpouse = typeof memberSpouses.$inferSelect;
export type NewMemberSpouse = typeof memberSpouses.$inferInsert;
export type MemberChild = typeof memberChildren.$inferSelect;
export type NewMemberChild = typeof memberChildren.$inferInsert;
export type MemberFamilyContact = typeof memberFamilyContacts.$inferSelect;
export type NewMemberFamilyContact = typeof memberFamilyContacts.$inferInsert;
export type MemberEmergencyContact = typeof memberEmergencyContacts.$inferSelect;
export type NewMemberEmergencyContact =
  typeof memberEmergencyContacts.$inferInsert;
export type MemberRelativeEmployed =
  typeof memberRelativesEmployed.$inferSelect;
export type NewMemberRelativeEmployed =
  typeof memberRelativesEmployed.$inferInsert;
export type MemberQualification = typeof memberQualifications.$inferSelect;
export type NewMemberQualification = typeof memberQualifications.$inferInsert;
export type MemberEmploymentHistory =
  typeof memberEmploymentHistory.$inferSelect;
export type NewMemberEmploymentHistory =
  typeof memberEmploymentHistory.$inferInsert;
export type MemberReference = typeof memberReferences.$inferSelect;
export type NewMemberReference = typeof memberReferences.$inferInsert;
