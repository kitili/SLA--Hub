/**
 * GET /api/bio/documents/[id]
 *
 * Streams a member-uploaded qualification certificate. Keyed by the
 * `member_documents` row id (a clean UUID) — the underlying storage key/blob
 * URL is never exposed to the client.
 *
 * Access control (self-gated; middleware excludes /api):
 *   - Must be signed in.
 *   - Must be the document's owner OR an admin.
 *   Any failure returns 404 (never 401/403) so the endpoint never confirms
 *   which document ids exist.
 *
 * Headers mirror the materials proxy: Content-Type derived from the stored
 * filename's extension (a spoofed MIME is never echoed), Content-Disposition
 * inline only for a render-safe allowlist (html/svg force-download), no-store,
 * and nosniff.
 */
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import {
  contentTypeForName,
  dispositionForType,
} from "@/lib/storage/http-headers";
import { getMemberDocumentWithOwner } from "@/lib/db/queries/bio-documents";

type Params = { id: string };

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return notFound();

  const { id } = await params;

  const found = await getMemberDocumentWithOwner(id);
  if (!found) return notFound();

  // Owner-or-admin only.
  if (!user.isAdmin && user.id !== found.ownerMemberId) return notFound();

  const { document } = found;
  if (!document.filePath) return notFound();

  let bytes: Buffer | null;
  try {
    bytes = await getStorage().read(document.filePath);
  } catch {
    return notFound();
  }
  if (bytes === null) return notFound();

  const name = document.originalName ?? "download";
  const mimeType = contentTypeForName(name);

  // Copy into a fresh ArrayBuffer to satisfy TypeScript's strict BlobPart type
  // (Buffer.buffer may be a SharedArrayBuffer, which is excluded).
  const arrayBuffer: ArrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": dispositionForType(mimeType, name),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
