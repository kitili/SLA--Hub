"use server";

/**
 * Bio-data server action (Wave 5A) — the ONLY mutation entry point for a
 * member's extended, PII-bearing bio profile.
 *
 * Policy enforced here (DSGVO / GDPR aware):
 *   1. The member must be authenticated. The owning member id is ALWAYS taken
 *      from the session (`getCurrentUser()`) — a client-supplied member id is
 *      never accepted (data minimization / access control).
 *   2. Required fields are validated with Zod (see {@link bioFormSchema}).
 *   3. Explicit consent is mandatory: the consent checkbox must be ticked, and
 *      the consent timestamp + version are persisted on the profile.
 *   4. Special-category data (health: disabilities; criminal:
 *      arrest/misconduct) is OPTIONAL and never required to submit.
 *   5. NOTHING in this file logs field values (no console.* of PII).
 *
 * Returns plain serialisable objects; never throws across the boundary for
 * expected outcomes, so the client can render friendly states.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
// Import the parse helper from its source module rather than the "@/lib/validation"
// barrel: that barrel re-exports with explicit ".js" specifiers which the
// webpack build cannot resolve when this server action is pulled into the graph
// (tsc/bundler resolution tolerates them, webpack does not). The barrel file is
// owned by another wave, so we avoid touching it.
import { parseOrError } from "@/lib/validation/parse";
import type { ApiError } from "@/lib/contracts/api";
import {
  getBioProfile,
  saveBioProfile,
  type BioReadResult,
  type BioWriteInput,
} from "@/lib/db/queries/bio";

/* ------------------------------------------------------------------ */
/* Consent versioning                                                  */
/* ------------------------------------------------------------------ */

/**
 * Bump this when the privacy-notice wording / processing purpose changes so a
 * member can be re-prompted for fresh consent. Persisted in
 * `member_profiles.consent_version`.
 *
 * Not exported: a "use server" module may only export async functions (and
 * types). It is internal to the action.
 */
const CONSENT_VERSION = "2026-06-bio-v1";

/* ------------------------------------------------------------------ */
/* Validation schema                                                   */
/* ------------------------------------------------------------------ */

/** Trim a string and turn "" into null (drafts/partials leave blanks empty). */
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v.length === 0 ? null : v))
  .nullish()
  .transform((v) => v ?? null);

/** A required, non-empty trimmed string with a translatable error key. */
function requiredText(errorKey: string, max = 255) {
  return z
    .string({ error: errorKey })
    .trim()
    .min(1, { error: errorKey })
    .max(max, { error: errorKey });
}

/** Optional ISO date string (yyyy-mm-dd) from <input type="date">; "" → null. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullish()
  .transform((v) => v ?? null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    error: "bio.errors.invalidDate",
  });

/** Optional Yes/No tri-state. The form sends "yes" | "no" | "" → boolean|null. */
const optionalYesNo = z
  .enum(["yes", "no"])
  .nullish()
  .transform((v) => (v === "yes" ? true : v === "no" ? false : null));

const optionalYear = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 1900 && v <= 2099), {
    error: "bio.errors.invalidYear",
  });

const spouseSchema = z
  .object({
    fullName: optionalText,
    phone: optionalText,
    occupation: optionalText,
    employer: optionalText,
  })
  .strict();

const childSchema = z
  .object({
    fullNames: optionalText,
    dateOfBirth: optionalDate,
    gender: optionalText,
    schoolEmployer: optionalText,
    contactNumber: optionalText,
  })
  .strict();

const familyContactSchema = z
  .object({
    relationship: optionalText,
    fullName: optionalText,
    phone: optionalText,
    address: optionalText,
    occupation: optionalText,
  })
  .strict();

const emergencyContactSchema = z
  .object({
    fullName: optionalText,
    relationship: optionalText,
    phone: optionalText,
    address: optionalText,
    priority: optionalText,
  })
  .strict();

const relativeEmployedSchema = z
  .object({
    fullName: optionalText,
    relationship: optionalText,
    position: optionalText,
    workStation: optionalText,
  })
  .strict();

const qualificationSchema = z
  .object({
    level: optionalText,
    qualification: optionalText,
    institution: optionalText,
    yearObtained: optionalYear,
  })
  .strict();

const employmentHistorySchema = z
  .object({
    employer: optionalText,
    position: optionalText,
    dateFrom: optionalDate,
    dateTo: optionalDate,
    leavingReason: optionalText,
  })
  .strict();

const referenceSchema = z
  .object({
    referenceOrder: z.number().int().min(1).max(3),
    fullName: optionalText,
    relationship: optionalText,
    phone: optionalText,
    email: optionalText,
    organization: optionalText,
  })
  .strict();

/**
 * The full bio form payload. Required fields mirror docs/bio-fields.md:
 * surname, first_name, gender, marital_status, mobile_phone,
 * residential_address, identification_no, position. The consent box is
 * required (must be `true`). Everything else — including all special-category
 * data — is optional.
 *
 * Internal (not exported): "use server" modules may only export async
 * functions + types. The inferred input type below IS exported for the client.
 */
const bioFormSchema = z.object({
  // -- Personal (required core)
  surname: requiredText("bio.errors.surnameRequired", 100),
  firstName: requiredText("bio.errors.firstNameRequired", 100),
  middleName: optionalText,
  otherNames: optionalText,
  maidenName: optionalText,
  gender: z.enum(["MALE", "FEMALE"], { error: "bio.errors.genderRequired" }),
  maritalStatus: z.enum(
    ["Single", "Married", "Divorced", "Widowed", "Separated"],
    { error: "bio.errors.maritalStatusRequired" },
  ),
  dateOfBirth: optionalDate,
  placeOfBirth: optionalText,
  nationality: optionalText,

  // -- Special category: health (GDPR Art. 9) — OPTIONAL
  hasDisabilities: optionalYesNo,
  disabilitiesDetails: optionalText,

  // -- Contact
  homePhone: optionalText,
  mobilePhone: requiredText("bio.errors.mobilePhoneRequired", 50),
  email: optionalText,
  residentialAddress: requiredText("bio.errors.residentialAddressRequired", 2000),

  // -- Identification documents
  identificationNo: requiredText("bio.errors.identificationNoRequired", 50),
  idPlaceOfIssue: optionalText,
  idExpiryDate: optionalDate,
  drivingPermitNo: optionalText,
  drivingPlaceOfIssue: optionalText,
  drivingExpiryDate: optionalDate,
  nssfNo: optionalText,
  tinNo: optionalText,
  nhifNo: optionalText,

  // -- Employment
  position: requiredText("bio.errors.positionRequired", 150),
  workStation: optionalText,

  // -- Banking
  bankName: optionalText,
  accountName: optionalText,
  accountNumber: optionalText,
  mobileMoneyNumber: optionalText,

  // -- Special category: criminal (GDPR Art. 9) — OPTIONAL
  arrestRecord: optionalYesNo,
  arrestDetails: optionalText,
  misconductRecord: optionalYesNo,
  misconductDetails: optionalText,

  // -- Declaration
  certificationName: optionalText,
  certificationDate: optionalDate,

  // -- Consent (REQUIRED). Must be true to submit.
  consent: z.literal(true, { error: "bio.errors.consentRequired" }),

  // -- Repeating groups
  spouse: spouseSchema.nullish(),
  children: z.array(childSchema).max(20).default([]),
  familyContacts: z.array(familyContactSchema).max(20).default([]),
  emergencyContacts: z.array(emergencyContactSchema).max(10).default([]),
  relativesEmployed: z.array(relativeEmployedSchema).max(20).default([]),
  qualifications: z.array(qualificationSchema).max(30).default([]),
  employmentHistory: z.array(employmentHistorySchema).max(30).default([]),
  references: z.array(referenceSchema).max(3).default([]),
}).strict();

/** Inferred *input* type — the serialisable shape the client form submits. */
export type BioFormInput = z.input<typeof bioFormSchema>;
/** Inferred *output* type — post-transform, what the action operates on. */
type BioFormParsed = z.output<typeof bioFormSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Whether a child row carries any meaningful data (drop fully-empty rows). */
function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some(
    (v) => v !== null && v !== undefined && v !== "",
  );
}

/** Map the validated form into the data-layer write shape. */
function toWriteInput(data: BioFormParsed): BioWriteInput {
  const spouse =
    data.spouse && hasAnyValue(data.spouse) ? data.spouse : null;

  return {
    profile: {
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      otherNames: data.otherNames,
      maidenName: data.maidenName,
      gender: data.gender,
      maritalStatus: data.maritalStatus,
      dateOfBirth: data.dateOfBirth,
      placeOfBirth: data.placeOfBirth,
      nationality: data.nationality,
      hasDisabilities: data.hasDisabilities,
      disabilitiesDetails: data.disabilitiesDetails,
      homePhone: data.homePhone,
      mobilePhone: data.mobilePhone,
      email: data.email,
      residentialAddress: data.residentialAddress,
      identificationNo: data.identificationNo,
      idPlaceOfIssue: data.idPlaceOfIssue,
      idExpiryDate: data.idExpiryDate,
      drivingPermitNo: data.drivingPermitNo,
      drivingPlaceOfIssue: data.drivingPlaceOfIssue,
      drivingExpiryDate: data.drivingExpiryDate,
      nssfNo: data.nssfNo,
      tinNo: data.tinNo,
      nhifNo: data.nhifNo,
      position: data.position,
      workStation: data.workStation,
      bankName: data.bankName,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      mobileMoneyNumber: data.mobileMoneyNumber,
      arrestRecord: data.arrestRecord,
      arrestDetails: data.arrestDetails,
      misconductRecord: data.misconductRecord,
      misconductDetails: data.misconductDetails,
      certificationName: data.certificationName,
      certificationDate: data.certificationDate,
      // Consent — recorded server-side at submission time.
      consentGivenAt: new Date(),
      consentVersion: CONSENT_VERSION,
    },
    spouse,
    children: data.children.filter(hasAnyValue),
    familyContacts: data.familyContacts.filter(hasAnyValue),
    emergencyContacts: data.emergencyContacts.filter(hasAnyValue),
    relativesEmployed: data.relativesEmployed.filter(hasAnyValue),
    qualifications: data.qualifications.filter(hasAnyValue),
    employmentHistory: data.employmentHistory.filter(hasAnyValue),
    references: data.references.filter(
      (r) => r.fullName || r.phone || r.email || r.organization || r.relationship,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Read (for prefilling the form)                                      */
/* ------------------------------------------------------------------ */

/**
 * Load the current user's own bio record (or `null`). Resolves the member id
 * from the session — never accepts one from the caller.
 */
export async function loadMyBio(): Promise<BioReadResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getBioProfile(user.id);
}

/* ------------------------------------------------------------------ */
/* Submit                                                              */
/* ------------------------------------------------------------------ */

export interface SaveBioResult {
  ok: boolean;
  /** Present only when ok === false. */
  error?: ApiError;
  /** Coarse error code for unauthenticated / unexpected failures. */
  code?: "unauthenticated" | "failed";
}

/**
 * Validate and persist the current user's bio profile.
 *
 * Auth: the member id is the authenticated session id — the client never sends
 * one. Validation: required fields + consent are enforced via Zod; on failure
 * the per-field error map is returned for inline display. No PII is logged.
 */
export async function saveMyBioAction(
  input: BioFormInput,
): Promise<SaveBioResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  const parsed = parseOrError(bioFormSchema, input);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  try {
    await saveBioProfile(user.id, toWriteInput(parsed.data));
  } catch {
    // Intentionally do not log the error object — it may echo field values.
    return { ok: false, code: "failed" };
  }

  // Refresh the bio page (and dashboard, for later completion wiring).
  revalidatePath("/[locale]/bio", "page");
  revalidatePath("/[locale]", "page");

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Dashboard wiring helper (exported for later use — does NOT touch the
   dashboard itself).                                                  */
/* ------------------------------------------------------------------ */

