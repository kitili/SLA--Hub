/**
 * GET /api/materials/[...key]
 *
 * Streams a stored material file back to the client. Both storage backends
 * route through here: the local filesystem adapter in dev, and (since blobs
 * became private) the Vercel Blob adapter, which proxies reads through this
 * handler so the token stays server-side and the browser never hits the CDN.
 *
 * Access control — this route is excluded from the locale middleware, so it
 * self-gates: only signed-in members may fetch files. Anonymous callers get a
 * 404 (not 401) so the endpoint never confirms which keys exist.
 *
 * Large videos in `documents/` support HTTP Range requests so players can
 * seek / start without downloading the entire file into memory first.
 *
 * Headers:
 *   Content-Type        — derived from the file extension
 *   Content-Disposition — inline only for a render-safe allowlist; html/svg and
 *                         other types are forced to download (no same-origin
 *                         script execution). nosniff blocks type re-sniffing.
 *   Cache-Control       — no-store (files may change; let DB/storage be SoT)
 *   Accept-Ranges       — bytes (when streaming from the local documents tree)
 */
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { contentTypeForName, dispositionForType } from "@/lib/storage/http-headers";
import {
  readLegacyDocument,
  readLegacyDocumentRange,
  statLegacyDocument,
} from "@/lib/storage/legacy-documents";

type Params = { key: string[] };

function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const rawStart = match[1];
  const rawEnd = match[2];
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    // bytes=-N → last N bytes
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function bufferResponse(
  bytes: Buffer,
  init: {
    status: number;
    mimeType: string;
    disposition: string;
    contentRange?: string;
    size?: number;
  },
): NextResponse {
  const arrayBuffer: ArrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  const headers: Record<string, string> = {
    "Content-Type": init.mimeType,
    "Content-Disposition": init.disposition,
    "Content-Length": String(bytes.byteLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (init.contentRange) headers["Content-Range"] = init.contentRange;

  return new NextResponse(arrayBuffer, {
    status: init.status,
    headers,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  // Members-only: middleware excludes /api, so this route enforces auth itself.
  // Return 404 (not 401) so we don't confirm key existence to anonymous callers.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key: segments } = await params;

  // Re-join segments and URL-decode to recover the original storage key.
  // LocalFileStorage.getUrl() encodes the key with encodeURIComponent, so a
  // single-segment catch-all like /api/materials/some-uuid-file.pdf arrives
  // as one element. Joining with "/" handles any edge-case multi-segment keys.
  const rawKey = segments.map(decodeURIComponent).join("/");
  const mimeType = contentTypeForName(rawKey);
  const disposition = dispositionForType(mimeType, rawKey);

  // Prefer the preserved documents/ tree for media so we can honour Range
  // requests with buffered slices (avoids Next.js stream controller races).
  const legacy = await statLegacyDocument(rawKey);
  if (legacy) {
    const range = parseRange(req.headers.get("range"), legacy.size);
    if (range) {
      const slice = await readLegacyDocumentRange(
        rawKey,
        range.start,
        range.end,
      );
      if (!slice) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return bufferResponse(slice, {
        status: 206,
        mimeType,
        disposition,
        contentRange: `bytes ${range.start}-${range.end}/${legacy.size}`,
      });
    }

    const full = await readLegacyDocument(rawKey);
    if (!full) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return bufferResponse(full, {
      status: 200,
      mimeType,
      disposition,
    });
  }

  let bytes: Buffer | null;
  try {
    bytes = await getStorage().read(rawKey);
  } catch {
    bytes = await readLegacyDocument(rawKey);
  }

  if (bytes === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return bufferResponse(bytes, {
    status: 200,
    mimeType,
    disposition,
  });
}
