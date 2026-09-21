import "server-only";

/**
 * Bio document data access — qualification certificates a member uploads in the
 * Qualifications & education section, stored in `member_documents`.
 *
 * These rows live independently of the bio child tables (which are wiped and
 * re-inserted on every save), so an uploaded file survives form edits.
 *
 * Like the sibling `queries/bio.ts`, everything is keyed by `memberId` (the
 * staff UUID resolved server-side); a client-supplied profile/document id is
 * never trusted for authorization — ownership is re-derived from the DB.
 */
import { and, eq } from "drizzle-orm";

import { db } from "../client";
import {
  memberDocuments,
  memberProfiles,
  type MemberDocument,
  type NewMemberDocument,
} from "../schema";

/**
 * Marker stored in `member_documents.document_type` for files uploaded through
 * the qualifications certificate bucket. Scopes the member/admin listings to
 * just these files even though the table is shared with other document types.
 */
export const QUALIFICATION_DOCUMENT_TYPE = "Qualification Certificate";

/** Marker for CV/résumé files uploaded in the bio form. */
export const CV_DOCUMENT_TYPE = "Curriculum Vitae";

/**
 * Prefix for per-qualification-row uploads: documentType is stored as
 * "QualDoc:0", "QualDoc:1", etc. so each row gets its own file bucket.
 */
export const QUALIFICATION_DOC_PREFIX = "QualDoc:";

/** The fields a caller supplies when recording an uploaded file. */
export type MemberDocumentInput = Pick<
  NewMemberDocument,
  "filePath" | "originalName" | "mimeType" | "fileSizeBytes"
>;

/**
 * Serialisable, PII-light projection of a document for client lists (member
 * upload UI and admin detail page). Never includes the storage key.
 */
export interface BioDocumentView {
  id: string;
  originalName: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
}

/** Map a stored row to the client view shape. */
export function toBioDocumentView(d: MemberDocument): BioDocumentView {
  return {
    id: d.id,
    originalName: d.originalName ?? "file",
    fileSizeBytes: d.fileSizeBytes ?? null,
    mimeType: d.mimeType ?? null,
  };
}

/** A document paired with the staff id that owns it (for proxy/delete auth). */
export interface MemberDocumentWithOwner {
  document: MemberDocument;
  ownerMemberId: string;
}

/** Canonical UUID shape — guards lookups so a crafted id yields a clean miss
 * (null) instead of a Postgres "invalid input syntax for type uuid" error. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a member's profile id, or `null` if they have not saved a bio yet. */
export async function getMemberProfileId(
  memberId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: memberProfiles.id })
    .from(memberProfiles)
    .where(eq(memberProfiles.memberId, memberId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Return the member's profile id, creating a minimal draft row if needed.
 * This lets file uploads proceed immediately without requiring the full bio
 * form to be submitted first. Consent is still captured at form-submit time.
 */
export async function ensureMemberProfileId(
  memberId: string,
): Promise<string> {
  const existing = await getMemberProfileId(memberId);
  if (existing) return existing;
  const rows = await db
    .insert(memberProfiles)
    .values({ memberId })
    .returning();
  return rows[0]!.id;
}

/** All qualification certificates for a member (empty if no profile yet). */
export async function listMemberDocuments(
  memberId: string,
): Promise<MemberDocument[]> {
  const profileId = await getMemberProfileId(memberId);
  if (!profileId) return [];
  return db
    .select()
    .from(memberDocuments)
    .where(
      and(
        eq(memberDocuments.memberProfileId, profileId),
        eq(memberDocuments.documentType, QUALIFICATION_DOCUMENT_TYPE),
      ),
    );
}

/**
 * All documents of every type for a member — used by the admin detail view
 * so admins can see CVs, qualification certificates, and per-qual uploads.
 */
export async function listAllMemberDocuments(
  memberId: string,
): Promise<MemberDocument[]> {
  const profileId = await getMemberProfileId(memberId);
  if (!profileId) return [];
  return db
    .select()
    .from(memberDocuments)
    .where(eq(memberDocuments.memberProfileId, profileId));
}

/** All CV files for a member (empty if no profile yet). */
export async function listMemberCvDocuments(
  memberId: string,
): Promise<MemberDocument[]> {
  const profileId = await getMemberProfileId(memberId);
  if (!profileId) return [];
  return db
    .select()
    .from(memberDocuments)
    .where(
      and(
        eq(memberDocuments.memberProfileId, profileId),
        eq(memberDocuments.documentType, CV_DOCUMENT_TYPE),
      ),
    );
}

/** Record an uploaded CV against a profile. */
export async function insertMemberCvDocument(
  profileId: string,
  input: MemberDocumentInput,
): Promise<MemberDocument> {
  const rows = await db
    .insert(memberDocuments)
    .values({
      memberProfileId: profileId,
      documentType: CV_DOCUMENT_TYPE,
      ...input,
    })
    .returning();
  return rows[0]!;
}

/**
 * All per-qualification-row documents for a member, grouped by row index.
 * Returns a plain object keyed by string index so it serialises to the client.
 */
export async function listMemberQualDocsByIndex(
  memberId: string,
): Promise<Record<string, BioDocumentView[]>> {
  const profileId = await getMemberProfileId(memberId);
  if (!profileId) return {};
  const rows = await db
    .select()
    .from(memberDocuments)
    .where(eq(memberDocuments.memberProfileId, profileId));
  const result: Record<string, BioDocumentView[]> = {};
  for (const row of rows) {
    const dt = row.documentType ?? "";
    if (!dt.startsWith(QUALIFICATION_DOC_PREFIX)) continue;
    const idx = dt.slice(QUALIFICATION_DOC_PREFIX.length);
    result[idx] = [...(result[idx] ?? []), toBioDocumentView(row)];
  }
  return result;
}

/** Record an uploaded file for a specific qualification row. */
export async function insertMemberQualDocument(
  profileId: string,
  qualIndex: number,
  input: MemberDocumentInput,
): Promise<MemberDocument> {
  const rows = await db
    .insert(memberDocuments)
    .values({
      memberProfileId: profileId,
      documentType: `${QUALIFICATION_DOC_PREFIX}${qualIndex}`,
      ...input,
    })
    .returning();
  return rows[0]!;
}

/** Load one document plus its owning staff id, or `null` if it does not exist. */
export async function getMemberDocumentWithOwner(
  documentId: string,
): Promise<MemberDocumentWithOwner | null> {
  if (!UUID_RE.test(documentId)) return null;
  const rows = await db
    .select({
      document: memberDocuments,
      ownerMemberId: memberProfiles.memberId,
    })
    .from(memberDocuments)
    .innerJoin(
      memberProfiles,
      eq(memberDocuments.memberProfileId, memberProfiles.id),
    )
    .where(eq(memberDocuments.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

/** Record an uploaded qualification certificate against a profile. */
export async function insertMemberDocument(
  profileId: string,
  input: MemberDocumentInput,
): Promise<MemberDocument> {
  const rows = await db
    .insert(memberDocuments)
    .values({
      memberProfileId: profileId,
      documentType: QUALIFICATION_DOCUMENT_TYPE,
      ...input,
    })
    .returning();
  return rows[0]!;
}

/**
 * Delete a document *only if* `memberId` owns it. Returns the deleted row (so
 * the caller can clean up the stored bytes) or `null` when not found / not
 * owned — callers translate `null` to a 404-style outcome.
 */
export async function deleteMemberDocumentOwnedBy(
  documentId: string,
  memberId: string,
): Promise<MemberDocument | null> {
  const found = await getMemberDocumentWithOwner(documentId);
  if (!found || found.ownerMemberId !== memberId) return null;
  await db.delete(memberDocuments).where(eq(memberDocuments.id, documentId));
  return found.document;
}
