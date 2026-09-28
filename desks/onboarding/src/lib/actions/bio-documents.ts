"use server";

/**
 * Bio document server actions — the member-facing entry points for uploading
 * and removing qualification certificates in the Qualifications & education
 * section. Decoupled from `saveMyBioAction`: files persist in `member_documents`
 * regardless of the bio form's save/replace cycle.
 *
 * Policy (mirrors @/lib/actions/bio.ts):
 *   1. The owning member id is ALWAYS the authenticated session id.
 *   2. Uploads require an existing (consented) profile — we never create a
 *      phantom profile here, so consent ordering is preserved.
 *   3. Files are validated against the documents-and-images allowlist + size
 *      cap before any bytes are stored.
 *   4. Nothing logs field values, filenames, or the error object.
 */
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import {
  BIO_DOCUMENT_EXTENSIONS,
  FORBIDDEN_UPLOAD_MIME,
  MAX_BIO_UPLOAD_BYTES,
  rejectionReason,
  sanitizeUploadName,
} from "@/lib/storage/upload-validation";
import {
  deleteMemberDocumentOwnedBy,
  ensureMemberProfileId,
  insertMemberDocument,
  insertMemberCvDocument,
  insertMemberQualDocument,
  toBioDocumentView,
  type BioDocumentView,
  type MemberDocumentInput,
} from "@/lib/db/queries/bio-documents";

export type UploadDocResult =
  | { ok: true; document: BioDocumentView }
  | {
      ok: false;
      code:
        | "unauthenticated"
        | "noFile"
        | "tooLarge"
        | "unsupportedType"
        | "profileRequired"
        | "failed";
    };

export type DeleteDocResult =
  | { ok: true }
  | { ok: false; code: "unauthenticated" | "notFound" | "failed" };

/**
 * Upload one qualification certificate for the current member.
 * Invoke from a transition with a `FormData` carrying a `file` field.
 */
export async function uploadBioDocumentAction(
  formData: FormData,
): Promise<UploadDocResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "noFile" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES) === "tooLarge") {
    return { ok: false, code: "tooLarge" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES)) {
    return { ok: false, code: "unsupportedType" };
  }

  try {
    // Auto-create a draft profile if none exists so uploads work immediately
    // without requiring the full bio form to be submitted first.
    const profileId = await ensureMemberProfileId(user.id);

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await getStorage().upload({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      data: bytes,
    });

    const input: MemberDocumentInput = {
      filePath: uploaded.key,
      originalName: sanitizeUploadName(file.name),
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
    };
    const row = await insertMemberDocument(profileId, input);

    revalidatePath("/[locale]/bio", "page");
    return { ok: true, document: toBioDocumentView(row) };
  } catch {
    // Never log: the error may echo a filename or other field value.
    return { ok: false, code: "failed" };
  }
}

/**
 * Upload one file for a specific qualification row (qualIndex = row position).
 */
export async function uploadQualDocumentAction(
  formData: FormData,
  qualIndex: number,
): Promise<UploadDocResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "noFile" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES) === "tooLarge") {
    return { ok: false, code: "tooLarge" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES)) {
    return { ok: false, code: "unsupportedType" };
  }

  try {
    const profileId = await ensureMemberProfileId(user.id);
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await getStorage().upload({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      data: bytes,
    });
    const input: MemberDocumentInput = {
      filePath: uploaded.key,
      originalName: sanitizeUploadName(file.name),
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
    };
    const row = await insertMemberQualDocument(profileId, qualIndex, input);
    revalidatePath("/[locale]/bio", "page");
    return { ok: true, document: toBioDocumentView(row) };
  } catch {
    return { ok: false, code: "failed" };
  }
}

/**
 * Upload one CV file for the current member.
 * Invoke from a transition with a `FormData` carrying a `file` field.
 */
export async function uploadCvDocumentAction(
  formData: FormData,
): Promise<UploadDocResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "noFile" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES) === "tooLarge") {
    return { ok: false, code: "tooLarge" };
  }
  if (rejectionReason(file, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES)) {
    return { ok: false, code: "unsupportedType" };
  }

  try {
    const profileId = await ensureMemberProfileId(user.id);

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await getStorage().upload({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      data: bytes,
    });

    const input: MemberDocumentInput = {
      filePath: uploaded.key,
      originalName: sanitizeUploadName(file.name),
      mimeType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
    };
    const row = await insertMemberCvDocument(profileId, input);

    revalidatePath("/[locale]/bio", "page");
    return { ok: true, document: toBioDocumentView(row) };
  } catch {
    return { ok: false, code: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Client-side Blob upload registration
// ---------------------------------------------------------------------------

export type RegisterDocInput = {
  blobUrl: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType:
    | "Qualification Certificate"
    | "Curriculum Vitae"
    | `QualDoc:${number}`;
};

/**
 * Register a bio document that was already uploaded directly to Vercel Blob
 * from the browser. The server action receives only the blob URL (no file
 * bytes), so there is no Vercel function body-size limit to worry about.
 */
export async function registerBioDocumentAction(
  input: RegisterDocInput,
): Promise<UploadDocResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  if (
    typeof input.blobUrl !== "string" ||
    !/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(input.blobUrl)
  ) {
    return { ok: false, code: "unsupportedType" };
  }
  if (
    typeof input.fileSizeBytes !== "number" ||
    !Number.isFinite(input.fileSizeBytes) ||
    input.fileSizeBytes < 1 ||
    input.fileSizeBytes > MAX_BIO_UPLOAD_BYTES
  ) {
    return { ok: false, code: "tooLarge" };
  }
  const mime = (input.mimeType || "").split(";")[0]!.trim().toLowerCase();
  if (FORBIDDEN_UPLOAD_MIME.has(mime)) {
    return { ok: false, code: "unsupportedType" };
  }
  const fake = new File([new Uint8Array(1)], input.filename, { type: mime });
  if (rejectionReason(fake, BIO_DOCUMENT_EXTENSIONS, MAX_BIO_UPLOAD_BYTES)) {
    return { ok: false, code: "unsupportedType" };
  }

  try {
    const profileId = await ensureMemberProfileId(user.id);

    const docInput: MemberDocumentInput = {
      filePath: input.blobUrl,
      originalName: sanitizeUploadName(input.filename),
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    };

    let row;
    if (input.documentType === "Curriculum Vitae") {
      row = await insertMemberCvDocument(profileId, docInput);
    } else if (input.documentType.startsWith("QualDoc:")) {
      const index = parseInt(input.documentType.slice("QualDoc:".length), 10);
      row = await insertMemberQualDocument(profileId, index, docInput);
    } else {
      row = await insertMemberDocument(profileId, docInput);
    }

    revalidatePath("/[locale]/bio", "page");
    return { ok: true, document: toBioDocumentView(row) };
  } catch {
    return { ok: false, code: "failed" };
  }
}

/** Remove one of the current member's certificates (owner-only). */
export async function deleteBioDocumentAction(
  documentId: string,
): Promise<DeleteDocResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "unauthenticated" };
  if (typeof documentId !== "string" || documentId.length === 0) {
    return { ok: false, code: "notFound" };
  }

  try {
    const removed = await deleteMemberDocumentOwnedBy(documentId, user.id);
    if (!removed) return { ok: false, code: "notFound" };

    // Best-effort byte cleanup — the row is already gone, orphan at worst.
    if (removed.filePath) {
      try {
        await getStorage().delete(removed.filePath);
      } catch {
        /* ignore storage errors */
      }
    }

    revalidatePath("/[locale]/bio", "page");
    return { ok: true };
  } catch {
    return { ok: false, code: "failed" };
  }
}
