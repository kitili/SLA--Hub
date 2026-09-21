import { NextResponse } from "next/server";

import { runWithRls } from "@/lib/db/rls";
import { getSetting } from "@/lib/app-settings";
import { sendHiringEmail } from "@/lib/hiring/mail";
import { recordUpload, resolveUploadToken } from "@/lib/hiring/pipeline";
import { storeHiringUpload } from "@/lib/hiring/storage";
import { escapeHtml } from "@/lib/security/html";
import { publicErrorMessage } from "@/lib/security/http";
import { securityLog } from "@/lib/security/log";
import {
  HIRING_DOCUMENT_EXTENSIONS,
  HIRING_VIDEO_EXTENSIONS,
  MAX_HIRING_UPLOAD_BYTES,
  rejectionReason,
  sanitizeUploadName,
} from "@/lib/storage/upload-validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";
  const stage = searchParams.get("stage") as "culture" | "performance" | null;

  if (!token || (stage !== "culture" && stage !== "performance")) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  return runWithRls({ hiringToken: token }, async () => {
    const candidate = await resolveUploadToken(token, stage);
    if (!candidate) {
      return NextResponse.json(
        { error: "Invalid or expired upload link" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      fullName: candidate.full_name,
      role: candidate.role_applied,
      stage,
      maxMB: MAX_HIRING_UPLOAD_BYTES / (1024 * 1024),
    });
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const stage = String(form.get("stage") || "") as "culture" | "performance";
  const file = form.get("file");

  if (!token || (stage !== "culture" && stage !== "performance")) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  // Fetch settings before entering the RLS context (app_settings is not
  // accessible under a hiringToken RLS session).
  const hrEmail =
    (await getSetting("hr_email")) ||
    process.env.GOOGLE_HR_EMAIL ||
    "jobs@silverleaf.co.tz";

  const allowed =
    stage === "culture" ? HIRING_VIDEO_EXTENSIONS : HIRING_DOCUMENT_EXTENSIONS;
  const rejected = rejectionReason(file, allowed, MAX_HIRING_UPLOAD_BYTES);
  if (rejected === "tooLarge") {
    return NextResponse.json(
      { error: "File is too large. Maximum is 25 MB." },
      { status: 400 },
    );
  }
  if (rejected) {
    securityLog("upload.rejected", { route: "hiring-upload" });
    return NextResponse.json(
      {
        error:
          stage === "culture"
            ? "Please upload a video file (mp4, webm, or mov)."
            : "Please upload a document or image (pdf, docx, or png/jpg).",
      },
      { status: 400 },
    );
  }

  return runWithRls({ hiringToken: token }, async () => {
    const candidate = await resolveUploadToken(token, stage);
    if (!candidate) {
      return NextResponse.json(
        { error: "Invalid or expired upload link" },
        { status: 404 },
      );
    }

    const safeName = sanitizeUploadName(file.name);
    const relativePath = `${stage}/${candidate.id}/${Date.now()}_${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileUrl = await storeHiringUpload({
      relativePath,
      bytes,
      contentType: file.type || "application/octet-stream",
    });

    try {
      const updated = await recordUpload({ token, stage, publicUrl: fileUrl });

      if (stage === "performance") {
        const subject = `Performance Task Submitted — ${candidate.full_name} (${candidate.role_applied})`;
        const htmlBody =
          `<p>A performance task submission has been received.</p>` +
          `<p><strong>Candidate:</strong> ${escapeHtml(candidate.full_name)}<br>` +
          `<strong>Role:</strong> ${escapeHtml(candidate.role_applied)}</p>` +
          `<p>The file is available in the hiring admin (not linked here).</p>` +
          `<p>Warm regards,<br>Silverleaf Academy Hiring System</p>`;

        // performanceManagerEmail stores comma-separated dept HOD emails selected by HR
        const deptEmails = (candidate.performance_manager_email ?? "")
          .split(",")
          .map((e) => e.trim())
          .filter((e) => e.includes("@"));

        sendHiringEmail({
          to: hrEmail,
          cc: deptEmails.length > 0 ? deptEmails.join(", ") : undefined,
          subject,
          htmlBody,
        }).catch(() => {
          securityLog("mail.failed", { route: "hiring-upload" });
        });
      }

      return NextResponse.json({
        success: true,
        stage: updated.stage,
      });
    } catch (err) {
      return NextResponse.json(
        { error: publicErrorMessage(err, "Upload failed") },
        { status: 500 },
      );
    }
  });
}
