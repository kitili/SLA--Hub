import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import type { EmailAttachment } from "@/lib/hiring/mail";
import { sendHiringEmail } from "@/lib/hiring/mail";
import { buildWelcomeEmail } from "@/lib/hiring/email-templates";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const toEmail = (form.get("email") as string | null)?.trim() ?? "";
  const toName = (form.get("name") as string | null)?.trim() || "Test Recipient";
  const role = (form.get("role") as string | null)?.trim() || "Staff Member";

  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let contractAttachment: EmailAttachment | undefined;
  const file = form.get("contract") as File | null;
  if (file && file.size > 0) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Contract must be a PDF or Word document (.pdf, .doc, .docx)" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Contract file must be 10 MB or smaller" },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    contractAttachment = { filename: file.name, content: buffer, contentType: file.type };
  }

  const htmlBody = buildWelcomeEmail(
    toName,
    role,
    toEmail,
    "This is a test. Your actual reporting details will be included here when the real email is sent.",
    undefined,
    Boolean(contractAttachment),
  );

  try {
    await sendHiringEmail({
      to: toEmail,
      subject: `[TEST] Welcome to Silverleaf Academy — ${toName}`,
      htmlBody,
      attachments: contractAttachment ? [contractAttachment] : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send: ${msg}` }, { status: 500 });
  }
}
