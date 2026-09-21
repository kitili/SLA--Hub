/**
 * POST /api/admin/blob-upload
 *
 * Issues a short-lived Vercel Blob client token so the browser can upload
 * large files (videos, etc.) directly to Vercel Blob without routing bytes
 * through a serverless function (which is capped at 4.5 MB).
 *
 * The client calls `upload()` from `@vercel/blob/client` pointing here as
 * the `handleUploadUrl`. After the upload completes, the client sends a
 * separate small server-action call to persist the DB record.
 */
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        access: "private",
        addRandomSuffix: false,
        maximumSizeInBytes: 500 * 1024 * 1024,
        allowedContentTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "video/mp4",
          "video/webm",
          "audio/mpeg",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
      }),
      onUploadCompleted: async () => {
        // DB registration is handled client-side via registerMaterialAction.
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
