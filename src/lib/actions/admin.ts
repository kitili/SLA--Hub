"use server";

/**
 * Admin server actions — the ONLY mutation entry points for the admin CMS
 * (sections, quizzes, materials). Every action:
 *   1. gates on `requireAdmin()` (redirects non-admins — see @/lib/auth),
 *   2. validates input with Zod via `parseOrError` (@/lib/validation),
 *   3. delegates to `src/lib/db/queries/admin.ts` (writes) and the storage
 *      adapter (@/lib/storage) for bytes,
 *   4. `revalidatePath`s the affected admin route.
 *
 * Actions return a small discriminated `ActionResult` so client forms can show
 * field errors without throwing. `is_correct` correctness is only ever set here
 * (server-side) — it never round-trips through a client as trusted data.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import {
  getConfiguredAdminPassword,
  hashAdminPassword,
  verifyAdminPassword,
} from "@/lib/auth/admin-passwords";
import type { ApiError } from "@/lib/contracts";
import { staffRepo } from "@/lib/db/repositories";
import * as adminQueries from "@/lib/db/queries/admin";
import { getStorage } from "@/lib/storage";
import { queueBriefingForMaterial } from "@/lib/policy-briefing-queue";
import { scheduleSlaBotKnowledgeSync } from "@/lib/sla-bot-knowledge";
import {
  MAX_UPLOAD_BYTES,
  MATERIAL_UPLOAD_EXTENSIONS,
  rejectionReason,
} from "@/lib/storage/upload-validation";
// Import the concrete module rather than the `@/lib/validation` barrel: the
// barrel re-exports with `.js` specifiers which TS resolves but webpack's
// server-action flight loader does not (it can't find `./parse.js`).
import { parseOrError } from "@/lib/validation/parse";

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError["error"] };

function fail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): { ok: false; error: ApiError["error"] } {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

const changeAdminPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(3, "Use at least 3 characters.")
      .max(128, "Password is too long."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export async function changeMyAdminPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = parseOrError(changeAdminPasswordSchema, {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const staff = await staffRepo.findStaffById(admin.id);
  if (!staff) return fail("not-found", "Admin account was not found.");

  const currentMatches = staff.adminPasswordHash
    ? verifyAdminPassword(parsed.data.currentPassword, staff.adminPasswordHash)
    : parsed.data.currentPassword === getConfiguredAdminPassword(admin.email);

  if (!currentMatches) {
    return fail("invalid-password", "Current password is not correct.", {
      currentPassword: ["Current password is not correct."],
    });
  }

  await staffRepo.setAdminPasswordHash(
    admin.id,
    hashAdminPassword(parsed.data.newPassword),
  );

  return ok(undefined);
}

// File-upload limits and the accepted-type allowlist live in
// `@/lib/storage/upload-validation` so the admin materials uploader and the
// member bio-document uploader share one source of truth.

// ---------------------------------------------------------------------------
// Zod schemas (admin-local; member-facing schemas live in @/lib/validation)
// ---------------------------------------------------------------------------

const localizedText = z.string().trim();

const sectionSlug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, numbers and hyphens only.",
  });

const createSectionSchema = z.object({
  id: sectionSlug,
  icon: localizedText.max(32).optional(),
  title_en: localizedText.min(1).max(255),
  title_sw: localizedText.max(255).optional(),
  description_en: localizedText.max(4000).optional(),
  description_sw: localizedText.max(4000).optional(),
  isPublished: z.boolean().optional(),
});

const updateSectionSchema = z.object({
  id: sectionSlug,
  icon: localizedText.max(32).optional(),
  title_en: localizedText.min(1).max(255),
  title_sw: localizedText.max(255).optional(),
  description_en: localizedText.max(4000).optional(),
  description_sw: localizedText.max(4000).optional(),
});

const sectionItemTypeSchema = z.enum([
  "pdf",
  "docx",
  "video",
  "image",
  "pptx",
  "link",
]);

const createSectionItemSchema = z.object({
  sectionId: sectionSlug,
  id: z
    .string()
    .max(50)
    .regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/, {
      message: "Use letters, numbers and hyphens only.",
    })
    .optional(),
  title_en: localizedText.min(1).max(255),
  title_sw: localizedText.max(255).optional(),
  note_en: localizedText.max(4000).optional(),
  note_sw: localizedText.max(4000).optional(),
  type: sectionItemTypeSchema.optional(),
});

const optionSchema = z.object({
  text_en: localizedText.min(1).max(2000),
  text_sw: localizedText.max(2000).optional(),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  text_en: localizedText.min(1).max(2000),
  text_sw: localizedText.max(2000).optional(),
  options: z.array(optionSchema).min(2).max(8),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce a FormData checkbox / "true"/"on" string to boolean. */
function asBool(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

function str(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

/** Validate a question's options have exactly the right shape (>=1 correct). */
function validateQuestionRules(
  input: z.infer<typeof questionSchema>,
): { ok: false; error: ApiError["error"] } | null {
  const correctCount = input.options.filter((o) => o.isCorrect).length;
  if (correctCount < 1) {
    return fail("VALIDATION_ERROR", "Each question needs at least one correct option.", {
      options: ["needOneCorrect"],
    });
  }
  return null;
}

// ===========================================================================
// SECTIONS
// ===========================================================================

export async function createSectionAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = parseOrError(createSectionSchema, {
    id: str(formData.get("id")),
    icon: str(formData.get("icon")),
    title_en: str(formData.get("title_en")),
    title_sw: str(formData.get("title_sw")),
    description_en: str(formData.get("description_en")),
    description_sw: str(formData.get("description_sw")),
    isPublished: asBool(formData.get("isPublished")),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const existing = await adminQueries.findSection(parsed.data.id);
  if (existing) {
    return fail("CONFLICT", "A section with that ID already exists.", {
      id: ["idTaken"],
    });
  }

  const section = await adminQueries.createSection({
    id: parsed.data.id,
    icon: parsed.data.icon ?? null,
    title_en: parsed.data.title_en,
    title_sw: parsed.data.title_sw ?? null,
    description_en: parsed.data.description_en ?? null,
    description_sw: parsed.data.description_sw ?? null,
    isPublished: parsed.data.isPublished ?? true,
  });

  revalidatePath("/admin/sections");
  scheduleSlaBotKnowledgeSync();
  return ok({ id: section.id });
}

export async function updateSectionAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = parseOrError(updateSectionSchema, {
    id: str(formData.get("id")),
    icon: str(formData.get("icon")),
    title_en: str(formData.get("title_en")),
    title_sw: str(formData.get("title_sw")),
    description_en: str(formData.get("description_en")),
    description_sw: str(formData.get("description_sw")),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const updated = await adminQueries.updateSection(parsed.data.id, {
    icon: parsed.data.icon ?? null,
    title_en: parsed.data.title_en,
    title_sw: parsed.data.title_sw ?? null,
    description_en: parsed.data.description_en ?? null,
    description_sw: parsed.data.description_sw ?? null,
  });
  if (!updated) return fail("NOT_FOUND", "Section not found.");

  revalidatePath("/admin/sections");
  revalidatePath(`/admin/sections/${parsed.data.id}`);
  scheduleSlaBotKnowledgeSync();
  return ok({ id: updated.id });
}

export async function toggleSectionPublishedAction(
  sectionId: string,
  isPublished: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const updated = await adminQueries.setSectionPublished(sectionId, isPublished);
  if (!updated) return fail("NOT_FOUND", "Section not found.");
  revalidatePath("/admin/sections");
  scheduleSlaBotKnowledgeSync();
  return ok(undefined);
}

export async function moveSectionAction(
  sectionId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireAdmin();
  if (direction !== "up" && direction !== "down") {
    return fail("VALIDATION_ERROR", "Invalid direction.");
  }
  await adminQueries.moveSection(sectionId, direction);
  revalidatePath("/admin/sections");
  return ok(undefined);
}

export async function createSectionItemAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = parseOrError(createSectionItemSchema, {
    sectionId: str(formData.get("sectionId")),
    id: str(formData.get("id")),
    title_en: str(formData.get("title_en")),
    title_sw: str(formData.get("title_sw")),
    note_en: str(formData.get("note_en")),
    note_sw: str(formData.get("note_sw")),
    type: str(formData.get("type")),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const section = await adminQueries.findSection(parsed.data.sectionId);
  if (!section) return fail("NOT_FOUND", "Section not found.");

  try {
    const item = await adminQueries.createSectionItem({
      sectionId: parsed.data.sectionId,
      id: parsed.data.id,
      title_en: parsed.data.title_en,
      title_sw: parsed.data.title_sw ?? null,
      note_en: parsed.data.note_en ?? null,
      note_sw: parsed.data.note_sw ?? null,
      type: parsed.data.type ?? "pdf",
    });

    revalidatePath(`/admin/sections/${parsed.data.sectionId}`);
    revalidatePath("/admin/sections");
    revalidatePath("/admin/materials");
    revalidatePath(`/section/${parsed.data.sectionId}`);
    revalidatePath("/");
    scheduleSlaBotKnowledgeSync();
    return ok({ id: item.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("ITEM_ID_TAKEN:")) {
      return fail("CONFLICT", "A learning item with that ID already exists.", {
        id: ["idTaken"],
      });
    }
    console.error("[admin/create-section-item]", error);
    return fail("INTERNAL", "Could not create the learning item.");
  }
}

// ===========================================================================
// QUIZZES
// ===========================================================================

function parseQuestionFromForm(formData: FormData):
  | { ok: true; data: z.infer<typeof questionSchema> }
  | { ok: false; error: ApiError["error"] } {
  // Options arrive as parallel arrays: optionTextEn[], optionTextSw[], correct index.
  const textsEn = formData.getAll("optionTextEn").map((v) => String(v).trim());
  const textsSw = formData.getAll("optionTextSw").map((v) => String(v).trim());
  const correctRaw = str(formData.get("correctOption"));
  const correctIndex = correctRaw !== undefined ? Number(correctRaw) : -1;

  const options = textsEn
    .map((text_en, i) => ({
      text_en,
      text_sw: textsSw[i] && textsSw[i]!.length ? textsSw[i]! : undefined,
      isCorrect: i === correctIndex,
    }))
    .filter((o) => o.text_en.length > 0);

  const parsed = parseOrError(questionSchema, {
    text_en: str(formData.get("questionTextEn")),
    text_sw: str(formData.get("questionTextSw")),
    options,
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const ruleError = validateQuestionRules(parsed.data);
  if (ruleError) return ruleError;

  return { ok: true, data: parsed.data };
}

export async function addQuestionAction(
  sectionId: string,
  _prev: ActionResult<{ questionId: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ questionId: string }>> {
  await requireAdmin();

  const section = await adminQueries.findSection(sectionId);
  if (!section) return fail("NOT_FOUND", "Section not found.");

  const parsed = parseQuestionFromForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const quizId = await adminQueries.ensureQuizForSection(sectionId);
  const questionId = await adminQueries.addQuizQuestion(quizId, {
    text_en: parsed.data.text_en,
    text_sw: parsed.data.text_sw ?? null,
    options: parsed.data.options.map((o) => ({
      text_en: o.text_en,
      text_sw: o.text_sw ?? null,
      isCorrect: o.isCorrect,
    })),
  });

  revalidatePath(`/admin/quizzes/${sectionId}`);
  revalidatePath("/admin/sections");
  return ok({ questionId });
}

export async function updateQuestionAction(
  sectionId: string,
  questionId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseQuestionFromForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await adminQueries.updateQuizQuestion(questionId, {
    text_en: parsed.data.text_en,
    text_sw: parsed.data.text_sw ?? null,
    options: parsed.data.options.map((o) => ({
      text_en: o.text_en,
      text_sw: o.text_sw ?? null,
      isCorrect: o.isCorrect,
    })),
  });

  revalidatePath(`/admin/quizzes/${sectionId}`);
  return ok(undefined);
}

export async function deleteQuestionAction(
  sectionId: string,
  questionId: string,
): Promise<ActionResult> {
  await requireAdmin();
  await adminQueries.deleteQuizQuestion(questionId);
  revalidatePath(`/admin/quizzes/${sectionId}`);
  return ok(undefined);
}

export async function setPassThresholdAction(
  sectionId: string,
  passThreshold: number,
): Promise<ActionResult> {
  await requireAdmin();
  const threshold = Number(passThreshold);
  if (!Number.isInteger(threshold) || threshold < 1) {
    return fail("VALIDATION_ERROR", "Pass threshold must be a positive integer.");
  }
  const quizId = await adminQueries.ensureQuizForSection(sectionId);
  await adminQueries.setQuizPassThreshold(quizId, threshold);
  revalidatePath(`/admin/quizzes/${sectionId}`);
  return ok(undefined);
}

// ===========================================================================
// MATERIALS
// ===========================================================================

const uploadMetaSchema = z.object({
  sectionItemId: z.string().trim().min(1).max(50),
  language: z.enum(["en", "sw", "none"]).default("none"),
});

export async function uploadMaterialAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("VALIDATION_ERROR", "Choose a file to upload.", {
      file: ["noFile"],
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "File is too large.", { file: ["tooLarge"] });
  }
  if (rejectionReason(file, MATERIAL_UPLOAD_EXTENSIONS)) {
    return fail("VALIDATION_ERROR", "Unsupported file type.", {
      file: ["unsupportedType"],
    });
  }

  const parsed = parseOrError(uploadMetaSchema, {
    sectionItemId: str(formData.get("sectionItemId")),
    language: str(formData.get("language")) ?? "none",
  });
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const item = await adminQueries.findSectionItem(parsed.data.sectionItemId);
  if (!item) {
    return fail("VALIDATION_ERROR", "Choose an item to attach the file to.", {
      sectionItemId: ["noItem"],
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const uploaded = await storage.upload({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    data: bytes,
  });

  const language = parsed.data.language === "none" ? null : parsed.data.language;
  const row = await adminQueries.createMaterialRow({
    sectionItemId: item.id,
    language,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    storageKey: uploaded.key,
    url: uploaded.url,
    uploadedBy: admin.id,
  });

  await queueBriefingForMaterial({
    material: row,
    item,
    createdBy: admin.id,
  });

  revalidatePath("/admin/materials");
  revalidatePath(`/admin/sections/${item.sectionId}`);
  scheduleSlaBotKnowledgeSync();
  return ok({ id: row.id });
}

const registerMetaSchema = z.object({
  blobUrl: z.string().url(),
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  size: z.number().int().positive(),
  sectionItemId: z.string().trim().min(1).max(50),
  language: z.enum(["en", "sw", "none"]).default("none"),
});

/**
 * Register a material that was uploaded directly to Vercel Blob from the
 * browser (client-side upload). Only the blob URL + metadata are sent here —
 * no file bytes touch the server.
 */
export async function registerMaterialAction(
  data: z.infer<typeof registerMetaSchema>,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const parsed = parseOrError(registerMetaSchema, data);
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const item = await adminQueries.findSectionItem(parsed.data.sectionItemId);
  if (!item) {
    return fail("VALIDATION_ERROR", "Section item not found.", {
      sectionItemId: ["noItem"],
    });
  }

  const language = parsed.data.language === "none" ? null : parsed.data.language;
  const row = await adminQueries.createMaterialRow({
    sectionItemId: item.id,
    language,
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
    storageKey: parsed.data.blobUrl,
    url: parsed.data.blobUrl,
    uploadedBy: admin.id,
  });

  await queueBriefingForMaterial({
    material: row,
    item,
    createdBy: admin.id,
  });

  revalidatePath("/admin/materials");
  revalidatePath(`/admin/sections/${item.sectionId}`);
  scheduleSlaBotKnowledgeSync();
  return ok({ id: row.id });
}

/** Extract a YouTube video ID from any common YouTube URL format. */
function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] ?? null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

const youtubeMeta = z.object({
  youtubeUrl: z.string().trim().min(1),
  sectionItemId: z.string().trim().min(1).max(50),
  language: z.enum(["en", "sw", "none"]).default("none"),
});

/** Save a YouTube video as a material — no file upload involved. */
export async function createYoutubeMaterialAction(
  data: z.infer<typeof youtubeMeta>,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const parsed = parseOrError(youtubeMeta, data);
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const videoId = extractYoutubeId(parsed.data.youtubeUrl);
  if (!videoId) {
    return fail("VALIDATION_ERROR", "Enter a valid YouTube URL.", {
      youtubeUrl: ["invalid"],
    });
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  const item = await adminQueries.findSectionItem(parsed.data.sectionItemId);
  if (!item) {
    return fail("VALIDATION_ERROR", "Choose an item to attach the video to.", {
      sectionItemId: ["noItem"],
    });
  }

  const language = parsed.data.language === "none" ? null : parsed.data.language;
  const row = await adminQueries.createMaterialRow({
    sectionItemId: item.id,
    language,
    filename: `YouTube: ${videoId}`,
    contentType: "video/youtube",
    size: 0,
    storageKey: embedUrl,
    url: embedUrl,
    uploadedBy: admin.id,
  });

  revalidatePath("/admin/materials");
  revalidatePath(`/admin/sections/${item.sectionId}`);
  return ok({ id: row.id });
}

export async function replaceYoutubeMaterialAction(
  materialId: string,
  youtubeUrl: string,
): Promise<ActionResult> {
  await requireAdmin();

  const videoId = extractYoutubeId(youtubeUrl.trim());
  if (!videoId) return fail("VALIDATION_ERROR", "Enter a valid YouTube URL.");

  const existing = await adminQueries.findMaterial(materialId);
  if (!existing) return fail("NOT_FOUND", "Material not found.");

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  await adminQueries.updateMaterialBytes(materialId, {
    filename: `YouTube: ${videoId}`,
    contentType: "video/youtube",
    size: 0,
    storageKey: embedUrl,
    url: embedUrl,
  });

  revalidatePath("/admin/materials");
  if (existing.sectionItemId) {
    const item = await adminQueries.findSectionItem(existing.sectionItemId);
    if (item) revalidatePath(`/admin/sections/${item.sectionId}`);
  }
  return ok(undefined);
}

// ===========================================================================
// MEMBER ADMIN MANAGEMENT
// ===========================================================================

export async function setMemberAdminAction(
  memberId: string,
  isAdmin: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  if (typeof memberId !== "string" || memberId.length === 0) {
    return fail("VALIDATION_ERROR", "Invalid member ID.");
  }
  const updated = await adminQueries.setMemberAdmin(memberId, isAdmin);
  if (!updated) return fail("NOT_FOUND", "Member not found.");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");
  return ok(undefined);
}

// ===========================================================================
// CAMPUSES
// ===========================================================================

export async function createCampusAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const name = str(formData.get("name"));
  if (!name || name.length === 0) {
    return fail("VALIDATION_ERROR", "Campus name is required.");
  }
  if (name.length > 150) {
    return fail("VALIDATION_ERROR", "Campus name must be 150 characters or fewer.");
  }
  try {
    const campus = await adminQueries.createCampus(name);
    revalidatePath("/admin/campuses");
    return ok({ id: campus.id });
  } catch (err: unknown) {
    // Postgres unique-constraint violation code: 23505
    const e = err as { code?: string };
    if (e?.code === "23505") {
      return fail("VALIDATION_ERROR", "Campus name already exists.");
    }
    throw err;
  }
}

export async function deleteCampusAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || id.length === 0) {
    return fail("VALIDATION_ERROR", "Invalid campus ID.");
  }
  const deleted = await adminQueries.deleteCampus(id);
  if (!deleted) return fail("NOT_FOUND", "Campus not found.");
  revalidatePath("/admin/campuses");
  revalidatePath("/admin/members");
  return ok(undefined);
}

export async function setMemberCampusAction(
  memberId: string,
  campus: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (typeof memberId !== "string" || memberId.length === 0) {
    return fail("VALIDATION_ERROR", "Invalid member ID.");
  }
  const updated = await adminQueries.setMemberCampus(memberId, campus);
  if (!updated) return fail("NOT_FOUND", "Member not found.");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");
  return ok(undefined);
}

export async function deleteMaterialAction(
  materialId: string,
): Promise<ActionResult> {
  await requireAdmin();

  const row = await adminQueries.deleteMaterialRow(materialId);
  if (!row) return fail("NOT_FOUND", "Material not found.");

  // Best-effort byte cleanup — the metadata row is already gone.
  try {
    await getStorage().delete(row.storageKey);
  } catch {
    // Ignore storage errors; the row is removed and the file is orphaned at worst.
  }

  revalidatePath("/admin/materials");
  if (row.sectionItemId) {
    const item = await adminQueries.findSectionItem(row.sectionItemId);
    if (item) revalidatePath(`/admin/sections/${item.sectionId}`);
  }
  return ok(undefined);
}

/**
 * Replace a material's bytes: upload the new file, repoint the row, delete the
 * old bytes. Keeps the same metadata row (and its attachment) so links survive.
 */
export async function replaceMaterialAction(
  materialId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const existing = await adminQueries.findMaterial(materialId);
  if (!existing) return fail("NOT_FOUND", "Material not found.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("VALIDATION_ERROR", "Choose a file to upload.", {
      file: ["noFile"],
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "File is too large.", { file: ["tooLarge"] });
  }
  if (rejectionReason(file, MATERIAL_UPLOAD_EXTENSIONS)) {
    return fail("VALIDATION_ERROR", "Unsupported file type.", {
      file: ["unsupportedType"],
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const uploaded = await storage.upload({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    data: bytes,
  });

  // Repoint the existing row in place — preserves id, attachment and language.
  const updated = await adminQueries.updateMaterialBytes(materialId, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    storageKey: uploaded.key,
    url: uploaded.url,
  });

  try {
    await storage.delete(existing.storageKey);
  } catch {
    // Ignore — old bytes orphaned at worst.
  }

  if (updated && existing.sectionItemId) {
    const item = await adminQueries.findSectionItem(existing.sectionItemId);
    if (item) {
      await queueBriefingForMaterial({
        material: updated,
        item,
        createdBy: admin.id,
      });
      revalidatePath(`/admin/sections/${item.sectionId}`);
    }
  }

  revalidatePath("/admin/materials");
  scheduleSlaBotKnowledgeSync();
  return ok(undefined);
}

const replaceBlobSchema = z.object({
  blobUrl: z.string().url(),
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  size: z.number().int().positive(),
});

/**
 * Register a replacement file that was uploaded directly from the browser to
 * Vercel Blob. Only metadata touches the server — no file bytes.
 */
export async function replaceMaterialBlobAction(
  materialId: string,
  data: z.infer<typeof replaceBlobSchema>,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = parseOrError(replaceBlobSchema, data);
  if (!parsed.ok) return { ok: false, error: parsed.error.error };

  const existing = await adminQueries.findMaterial(materialId);
  if (!existing) return fail("NOT_FOUND", "Material not found.");

  const updated = await adminQueries.updateMaterialBytes(materialId, {
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
    storageKey: parsed.data.blobUrl,
    url: parsed.data.blobUrl,
  });

  try {
    await getStorage().delete(existing.storageKey);
  } catch {
    // Old blob orphaned at worst — not a hard failure.
  }

  if (updated && existing.sectionItemId) {
    const item = await adminQueries.findSectionItem(existing.sectionItemId);
    if (item) {
      await queueBriefingForMaterial({
        material: updated,
        item,
        createdBy: admin.id,
      });
      revalidatePath(`/admin/sections/${item.sectionId}`);
    }
  }

  revalidatePath("/admin/materials");
  scheduleSlaBotKnowledgeSync();
  return ok(undefined);
}
