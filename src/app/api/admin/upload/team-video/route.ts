import { NextResponse, type NextRequest } from "next/server";
import { put, del } from "@vercel/blob";

import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { getSetting, setSetting } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const SINGLE_KEYS = new Set(["team_video_ceo", "team_video_hos", "team_video_hr"]);
const ALL_KEYS = new Set([...SINGLE_KEYS, "team_video_dept"]);

/**
 * PUT /api/admin/upload/team-video?settingKey=...&filename=...
 *
 * Body: raw binary video (Content-Type: video/*)
 *
 * We read req.body directly — no req.formData() — so Next.js's body parser
 * never runs and there is no framework-level size cap. The file streams
 * straight through to Vercel Blob without buffering in memory.
 */
export async function PUT(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settingKey = req.nextUrl.searchParams.get("settingKey")?.trim();
  const filename = req.nextUrl.searchParams.get("filename")?.trim() ?? "video.mp4";
  const contentType = req.headers.get("content-type") ?? "video/mp4";

  if (!settingKey || !ALL_KEYS.has(settingKey)) {
    return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
  }
  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: `Must be a video (got: ${contentType})` }, { status: 400 });
  }
  if (!req.body) {
    return NextResponse.json({ error: "No file body" }, { status: 400 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 500 });
  }

  if (SINGLE_KEYS.has(settingKey)) {
    const existing = await getSetting(settingKey);
    if (existing?.includes("blob.vercel-storage.com")) {
      await del(existing, { token: blobToken }).catch(() => null);
    }
  }

  try {
    const ext = filename.split(".").pop() ?? "mp4";
    const { url } = await put(
      `team-videos/${settingKey}-${Date.now()}.${ext}`,
      req.body,
      { access: "private", contentType, token: blobToken },
    );

    if (SINGLE_KEYS.has(settingKey)) {
      await setSetting(settingKey, url);
    }

    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/upload/team-video
 * ?blobUrl=<url>   — delete a specific blob (dept list item removal)
 * ?key=<key>       — delete blob + clear single-value setting
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  const blobUrl = req.nextUrl.searchParams.get("blobUrl")?.trim();
  if (blobUrl) {
    if (!blobUrl.includes("blob.vercel-storage.com")) {
      return NextResponse.json({ error: "Not a Vercel Blob URL" }, { status: 400 });
    }
    await del(blobUrl, { token: blobToken }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  const key = req.nextUrl.searchParams.get("key")?.trim();
  if (!key || !SINGLE_KEYS.has(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  const existing = await getSetting(key);
  if (existing?.includes("blob.vercel-storage.com")) {
    await del(existing, { token: blobToken }).catch(() => null);
  }
  await setSetting(key, "");

  return NextResponse.json({ ok: true });
}
