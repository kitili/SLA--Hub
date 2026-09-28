import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export class UploadValidationError extends Error {}

export async function uploadPublicFile(file: File, folder: string) {
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadValidationError("File is too large (max 5MB).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Sniff actual file contents rather than trusting the browser-supplied MIME type/extension.
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new UploadValidationError("Unsupported file type. Allowed: PNG, JPEG, WebP, PDF.");
  }

  const randomName = `${randomUUID()}.${detected.ext}`;
  const blob = await put(`${folder}/${randomName}`, buffer, {
    access: "public",
    contentType: detected.mime,
  });

  return {
    url: blob.url,
    filename: file.name.slice(0, 255),
    mimeType: detected.mime,
    size: file.size,
  };
}

export async function uploadTicketAttachment(file: File) {
  return uploadPublicFile(file, "ticket-attachments");
}

export async function uploadTaskAttachment(file: File) {
  return uploadPublicFile(file, "task-attachments");
}
