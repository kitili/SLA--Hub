import fs from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { resolveHiringDiskPath } from "@/lib/hiring/storage";

function downloadHeaders(contentType: string, filename: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
  };
}

/** HR-only file download for culture / performance submissions. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await context.params;
  if (!segments?.length || segments.length > 8) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relative = segments.map(decodeURIComponent).join("/");
  const full = resolveHiringDiskPath(relative);
  if (!full) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(full);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    const contentType =
      ext === ".mp4"
        ? "video/mp4"
        : ext === ".webm"
          ? "video/webm"
          : ext === ".pdf"
            ? "application/pdf"
            : "application/octet-stream";

    return new NextResponse(bytes, {
      headers: {
        ...downloadHeaders(contentType, path.basename(full)),
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
