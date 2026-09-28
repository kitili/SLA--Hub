import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { storeHiringUpload } from "@/lib/hiring/storage";
import { securityLog } from "@/lib/security/log";
import {
  HIRING_DOCUMENT_EXTENSIONS,
  MAX_HIRING_UPLOAD_BYTES,
  rejectionReason,
  sanitizeUploadName,
} from "@/lib/storage/upload-validation";

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const rejected = rejectionReason(
    file,
    HIRING_DOCUMENT_EXTENSIONS,
    MAX_HIRING_UPLOAD_BYTES,
  );
  if (rejected === "tooLarge") {
    return NextResponse.json(
      { error: "File too large. Maximum is 25 MB." },
      { status: 400 },
    );
  }
  if (rejected) {
    securityLog("upload.rejected", { route: "performance-tasks" });
    return NextResponse.json(
      { error: "Please upload a document or image (pdf, docx, or png/jpg)." },
      { status: 400 },
    );
  }

  try {
    const safeName = sanitizeUploadName(file.name);
    const relativePath = `performance-tasks/${Date.now()}_${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const url = await storeHiringUpload({
      relativePath,
      bytes,
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json({ url, name: safeName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
