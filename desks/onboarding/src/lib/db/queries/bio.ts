import "server-only";

/**
 * Bio-data data access (Wave 5A) — the single read/write surface for a member's
 * extended, PII-bearing bio profile (`member_profiles` + its child tables).
 *
 * Design:
 *   - Everything is keyed by `memberId` (the staff UUID). This module NEVER
 *     trusts an arbitrary profile id from a caller; the owning server action
 *     resolves `memberId` from the authenticated session only.
 *   - The flat profile is upserted (insert-or-update on the UNIQUE member_id).
 *   - Child rows follow a delete-then-insert ("replace") strategy inside a
 *     single transaction so a save is atomic and idempotent — re-submitting the
 *     form never duplicates rows.
 *   - This layer does NO validation and NO authorization. It also never logs
 *     field values (DSGVO data minimization). Required-field policy lives in
 *     the validation/action layer.
 *
 * Separated from the single-table repositories because a bio save spans ten
 * tables in one transaction; that orchestration belongs here, not in a repo.
 */
import { eq } from "drizzle-orm";

import {
  decryptFields,
  decryptString,
  encryptFields,
  encryptString,
} from "../../security/encrypt";

// Relative imports (not the "@/lib/db" alias) so the data layer also resolves
// under the plain-Node db CLI scripts (migrate/seed), matching the sibling
// query modules (e.g. queries/signoff.ts).
import { db, type PgliteDb } from "../client";
import {
  memberChildren,
  memberEmergencyContacts,
  memberEmploymentHistory,
  memberFamilyContacts,
  memberProfiles,
  memberQualifications,
  memberReferences,
  memberRelativesEmployed,
  memberSpouses,
  type MemberChild,
  type MemberEmergencyContact,
  type MemberEmploymentHistory,
  type MemberFamilyContact,
  type MemberProfile,
  type MemberQualification,
  type MemberReference,
  type MemberRelativeEmployed,
  type MemberSpouse,
} from "../schema";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Columns of `member_profiles` that callers may set (everything except the
 * surrogate id, the owning member_id, and the auto timestamps). */
export type ProfileInput = Partial<
  Omit<
    MemberProfile,
    "id" | "memberId" | "submittedAt" | "updatedAt"
  >
>;

/** A single child row payload (without ids — the owning FK is filled in here). */
type ChildInput<T> = Omit<T, "id" | "memberProfileId">;

/** The complete bio payload the action layer hands to {@link saveBioProfile}. */
export interface BioWriteInput {
  profile: ProfileInput;
  spouse?: ChildInput<MemberSpouse> | null;
  children?: ChildInput<MemberChild>[];
  familyContacts?: ChildInput<MemberFamilyContact>[];
  emergencyContacts?: ChildInput<MemberEmergencyContact>[];
  relativesEmployed?: ChildInput<MemberRelativeEmployed>[];
  qualifications?: ChildInput<MemberQualification>[];
  employmentHistory?: ChildInput<MemberEmploymentHistory>[];
  references?: ChildInput<MemberReference>[];
}

/** The full bio record read back for prefilling the form. */
export interface BioReadResult {
  profile: MemberProfile;
  spouse: MemberSpouse | null;
  children: MemberChild[];
  familyContacts: MemberFamilyContact[];
  emergencyContacts: MemberEmergencyContact[];
  relativesEmployed: MemberRelativeEmployed[];
  qualifications: MemberQualification[];
  employmentHistory: MemberEmploymentHistory[];
  references: MemberReference[];
}

const PROFILE_PII = [
  "homePhone",
  "mobilePhone",
  "identificationNo",
  "drivingPermitNo",
  "nssfNo",
  "tinNo",
  "nhifNo",
  "accountNumber",
  "mobileMoneyNumber",
  "arrestDetails",
  "misconductDetails",
] as const satisfies readonly (keyof ProfileInput)[];

function encryptProfile(profile: ProfileInput): ProfileInput {
  return encryptFields(profile as Record<string, unknown>, PROFILE_PII) as ProfileInput;
}

function decryptProfile(profile: MemberProfile): MemberProfile {
  return decryptFields(profile as Record<string, unknown>, PROFILE_PII) as MemberProfile;
}

function encryptPhone<T extends { phone?: string | null }>(row: T): T {
  if (typeof row.phone === "string") {
    return { ...row, phone: encryptString(row.phone) };
  }
  return row;
}

function decryptPhone<T extends { phone?: string | null }>(row: T): T {
  if (typeof row.phone === "string") {
    return { ...row, phone: decryptString(row.phone) };
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

/**
 * Load the full bio record for a member, or `null` if no profile exists yet.
 *
 * @param memberId  the authenticated staff UUID (resolved server-side).
 */
export async function getBioProfile(
  memberId: string,
): Promise<BioReadResult | null> {
  const profileRows = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.memberId, memberId))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) return null;

  const pid = profile.id;

  const [
    spouseRows,
    children,
    familyContacts,
    emergencyContacts,
    relativesEmployed,
    qualifications,
    employmentHistory,
    references,
  ] = await Promise.all([
    db
      .select()
      .from(memberSpouses)
      .where(eq(memberSpouses.memberProfileId, pid))
      .limit(1),
    db
      .select()
      .from(memberChildren)
      .where(eq(memberChildren.memberProfileId, pid)),
    db
      .select()
      .from(memberFamilyContacts)
      .where(eq(memberFamilyContacts.memberProfileId, pid)),
    db
      .select()
      .from(memberEmergencyContacts)
      .where(eq(memberEmergencyContacts.memberProfileId, pid)),
    db
      .select()
      .from(memberRelativesEmployed)
      .where(eq(memberRelativesEmployed.memberProfileId, pid)),
    db
      .select()
      .from(memberQualifications)
      .where(eq(memberQualifications.memberProfileId, pid)),
    db
      .select()
      .from(memberEmploymentHistory)
      .where(eq(memberEmploymentHistory.memberProfileId, pid)),
    db
      .select()
      .from(memberReferences)
      .where(eq(memberReferences.memberProfileId, pid)),
  ]);

  return {
    profile: decryptProfile(profile),
    spouse: spouseRows[0] ? decryptPhone(spouseRows[0]) : null,
    children: children.map((c) =>
      typeof c.contactNumber === "string"
        ? { ...c, contactNumber: decryptString(c.contactNumber) }
        : c,
    ),
    familyContacts: familyContacts.map(decryptPhone),
    emergencyContacts: emergencyContacts.map(decryptPhone),
    relativesEmployed,
    qualifications,
    employmentHistory,
    references: references.map(decryptPhone),
  };
}

/**
 * Lightweight existence/completeness probe for dashboard wiring.
 * Returns whether the member has a saved profile *and* whether consent is on
 * record. Reads a single indexed row; no PII is returned.
 */
export async function getBioStatus(
  memberId: string,
): Promise<{ exists: boolean; consentGiven: boolean; submittedAt: Date | null }> {
  const rows = await db
    .select({
      consentGivenAt: memberProfiles.consentGivenAt,
      submittedAt: memberProfiles.submittedAt,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.memberId, memberId))
    .limit(1);

  const row = rows[0];
  if (!row) return { exists: false, consentGiven: false, submittedAt: null };
  return {
    exists: true,
    consentGiven: row.consentGivenAt != null,
    submittedAt: row.submittedAt ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert a member's flat profile and replace all of its child rows, atomically.
 *
 * - The profile is matched on the UNIQUE `member_id`; first save inserts, later
 *   saves update. `updatedAt` is always bumped.
 * - Each child group is deleted then re-inserted ("replace") so the saved set
 *   exactly mirrors the submitted form with no duplicates and no orphans.
 * - Empty/whitespace child rows are expected to be filtered out by the caller;
 *   this function inserts exactly what it is given.
 *
 * @returns the persisted profile id.
 */
export async function saveBioProfile(
  memberId: string,
  input: BioWriteInput,
): Promise<{ profileId: string }> {
  // `db` is typed as the union of both drivers (PGlite | postgres-js). Their
  // `transaction()` overloads don't unify when the callback returns a projected
  // shape, so we narrow to one concrete driver type for type-checking only. The
  // Drizzle query builder emits identical, driver-agnostic SQL either way.
  const tdb = db as PgliteDb;
  return tdb.transaction(async (tx) => {
    // 1) Upsert the flat profile on the unique member_id.
    const encryptedProfile = encryptProfile(input.profile);
    const upserted = await tx
      .insert(memberProfiles)
      .values({ memberId, ...encryptedProfile, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: memberProfiles.memberId,
        set: { ...encryptedProfile, updatedAt: new Date() },
      })
      .returning({ id: memberProfiles.id });

    const profileId = upserted[0]!.id;

    // 2) Replace each child group. Delete-all-then-insert keeps the write
    //    idempotent and mirrors exactly what the form submitted.
    await tx
      .delete(memberSpouses)
      .where(eq(memberSpouses.memberProfileId, profileId));
    if (input.spouse) {
      await tx
        .insert(memberSpouses)
        .values({ memberProfileId: profileId, ...encryptPhone(input.spouse) });
    }

    await tx
      .delete(memberChildren)
      .where(eq(memberChildren.memberProfileId, profileId));
    if (input.children?.length) {
      await tx
        .insert(memberChildren)
        .values(
          input.children.map((c) => ({
            memberProfileId: profileId,
            ...c,
            contactNumber:
              typeof c.contactNumber === "string"
                ? encryptString(c.contactNumber)
                : c.contactNumber,
          })),
        );
    }

    await tx
      .delete(memberFamilyContacts)
      .where(eq(memberFamilyContacts.memberProfileId, profileId));
    if (input.familyContacts?.length) {
      await tx
        .insert(memberFamilyContacts)
        .values(
          input.familyContacts.map((c) => ({
            memberProfileId: profileId,
            ...encryptPhone(c),
          })),
        );
    }

    await tx
      .delete(memberEmergencyContacts)
      .where(eq(memberEmergencyContacts.memberProfileId, profileId));
    if (input.emergencyContacts?.length) {
      await tx
        .insert(memberEmergencyContacts)
        .values(
          input.emergencyContacts.map((c) => ({
            memberProfileId: profileId,
            ...encryptPhone(c),
          })),
        );
    }

    await tx
      .delete(memberRelativesEmployed)
      .where(eq(memberRelativesEmployed.memberProfileId, profileId));
    if (input.relativesEmployed?.length) {
      await tx
        .insert(memberRelativesEmployed)
        .values(
          input.relativesEmployed.map((c) => ({
            memberProfileId: profileId,
            ...c,
          })),
        );
    }

    await tx
      .delete(memberQualifications)
      .where(eq(memberQualifications.memberProfileId, profileId));
    if (input.qualifications?.length) {
      await tx
        .insert(memberQualifications)
        .values(
          input.qualifications.map((c) => ({
            memberProfileId: profileId,
            ...c,
          })),
        );
    }

    await tx
      .delete(memberEmploymentHistory)
      .where(eq(memberEmploymentHistory.memberProfileId, profileId));
    if (input.employmentHistory?.length) {
      await tx
        .insert(memberEmploymentHistory)
        .values(
          input.employmentHistory.map((c) => ({
            memberProfileId: profileId,
            ...c,
          })),
        );
    }

    await tx
      .delete(memberReferences)
      .where(eq(memberReferences.memberProfileId, profileId));
    if (input.references?.length) {
      await tx
        .insert(memberReferences)
        .values(
          input.references.map((c) => ({
            memberProfileId: profileId,
            ...encryptPhone(c),
          })),
        );
    }

    return { profileId };
  });
}
