import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { isBlobStoredUrl, readHiringUpload } from "@/lib/hiring/storage";

/** HR-only proxy for private Blob or local hiring uploads. */
export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const isLocalHiring =
    url.includes("/api/hiring/files/") || url.startsWith("/api/hiring/files/");
  if (!isBlobStoredUrl(url) && !isLocalHiring) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readHiringUpload(url);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = url.split(".").pop()?.toLowerCase().split("?")[0] || "";
  const contentType =
    ext === "mp4"
      ? "video/mp4"
      : ext === "webm"
        ? "video/webm"
        : ext === "pdf"
          ? "application/pdf"
          : "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="hiring-file${ext ? `.${ext}` : ""}"`,
    },
  });
}
