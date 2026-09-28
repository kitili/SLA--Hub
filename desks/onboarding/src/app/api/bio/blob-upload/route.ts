/**
 * POST /api/bio/blob-upload
 *
 * Issues a short-lived Vercel Blob client token so the browser can upload
 * bio documents (qualification certificates, CV) directly to Vercel Blob
 * without routing bytes through a serverless function (which is capped at
 * ~4.5 MB in practice).
 *
 * The client calls `upload()` from `@vercel/blob/client` pointing here as
 * the `handleUploadUrl`. After the upload completes the client sends a
 * separate small server-action call (`registerBioDocumentAction`) to persist
 * the DB record.
 */
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        access: "private",
        addRandomSuffix: true,
        maximumSizeInBytes: 10 * 1024 * 1024,
        allowedContentTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
      }),
      onUploadCompleted: async () => {
        // DB registration is handled client-side via registerBioDocumentAction.
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload error" },
      { status: 400 },
    );
  }
}
