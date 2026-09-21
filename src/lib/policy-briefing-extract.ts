import "server-only";

import { createHash } from "node:crypto";

import type { Material } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { readLegacyDocument } from "@/lib/storage/legacy-documents";
import { isExtractablePolicyFile } from "@/lib/policy-briefing-script";

const PDF_MAGIC = Buffer.from("%PDF");

async function extractPdfText(bytes: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(bytes), { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  return (text ?? "").trim();
}

async function extractDocxText(bytes: Buffer): Promise<string> {
  const mammothMod = await import("mammoth");
  const mammoth = mammothMod.default ?? mammothMod;
  const result = await mammoth.extractRawText({ buffer: bytes });
  return (result.value ?? "").trim();
}

function looksLikePdf(bytes: Buffer, filename: string, contentType: string): boolean {
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(PDF_MAGIC)) return true;
  const name = filename.toLowerCase();
  const type = contentType.toLowerCase();
  return name.endsWith(".pdf") || type.includes("pdf");
}

function looksLikeDocx(filename: string, contentType: string): boolean {
  const name = filename.toLowerCase();
  const type = contentType.toLowerCase();
  return (
    name.endsWith(".docx") ||
    type.includes("wordprocessingml") ||
    type === "application/msword"
  );
}

export async function readMaterialBytes(
  material: Pick<Material, "storageKey" | "url">,
): Promise<Buffer | null> {
  const storage = getStorage();
  try {
    const fromStore = await storage.read(material.storageKey);
    if (fromStore && fromStore.length > 0) return fromStore;
  } catch {
    // Invalid local keys (legacy document paths) throw; try other backends.
  }

  const legacyKey = material.storageKey.replace(/^documents\//, "");
  const fromLegacy = await readLegacyDocument(legacyKey);
  if (fromLegacy && fromLegacy.length > 0) return fromLegacy;

  const fetchUrl =
    material.url.startsWith("http://") || material.url.startsWith("https://")
      ? material.url
      : material.storageKey.startsWith("http://") ||
          material.storageKey.startsWith("https://")
        ? material.storageKey
        : null;
  if (!fetchUrl) return null;

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function extractPolicyDocumentText(input: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  const { bytes, filename, contentType } = input;
  if (!isExtractablePolicyFile(filename, contentType) && !bytes.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error("UNSUPPORTED_TYPE");
  }

  if (looksLikePdf(bytes, filename, contentType)) {
    return extractPdfText(bytes);
  }
  if (looksLikeDocx(filename, contentType)) {
    return extractDocxText(bytes);
  }
  if (filename.toLowerCase().endsWith(".txt") || contentType === "text/plain") {
    return bytes.toString("utf8").trim();
  }
  throw new Error("UNSUPPORTED_TYPE");
}

export function hashPolicyText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
