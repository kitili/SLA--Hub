"use client";

import { createClient } from "@/lib/supabase/client";
import {
  slotStoragePaths,
  type DriverDocSlot,
} from "@/lib/storage/driver-doc-slots";

export type { DriverDocSlot } from "@/lib/storage/driver-doc-slots";
export { slotColumn } from "@/lib/storage/driver-doc-slots";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PDF_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
};

const PDF_OK: ReadonlySet<DriverDocSlot> = new Set([
  "cv",
  "license",
  "medical",
  "national-id",
  "passport",
  "psv-badge",
]);

const MAX_BYTES = 8 * 1024 * 1024;

export function validateDriverDocument(
  file: File,
  slot: DriverDocSlot,
): string | null {
  const allowed = PDF_OK.has(slot)
    ? { ...IMAGE_TYPES, ...PDF_TYPES }
    : IMAGE_TYPES;
  if (!(file.type in allowed)) {
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
      return "Use JPG/PNG/WEBP (iPhone: Most Compatible), or PDF for documents.";
    }
    return PDF_OK.has(slot)
      ? "JPG, PNG, WEBP, or PDF only."
      : "JPG, PNG, or WEBP only for photos.";
  }
  if (file.size > MAX_BYTES) return "File is too large — 8MB max.";
  return null;
}

export async function uploadDriverDocument(
  driverId: string,
  slot: DriverDocSlot,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const validationError = validateDriverDocument(file, slot);
  if (validationError) return { error: validationError };

  const allowed = PDF_OK.has(slot)
    ? { ...IMAGE_TYPES, ...PDF_TYPES }
    : IMAGE_TYPES;
  const ext = allowed[file.type];
  const path = `${driverId}/${slot}.${ext}`;

  const supabase = createClient();
  await supabase.storage
    .from("driver-documents")
    .remove(slotStoragePaths(driverId, slot).filter((p) => p !== path));

  const { error } = await supabase.storage
    .from("driver-documents")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { error: error.message };
  return { path };
}

export async function deleteDriverDocumentFiles(
  driverId: string,
  slot: DriverDocSlot,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("driver-documents")
    .remove(slotStoragePaths(driverId, slot));
  if (error) return { error: error.message };
  return { ok: true };
}
