import { NextResponse } from "next/server";

import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import type { EmailAttachment } from "@/lib/hiring/mail";
import { sendCandidateWelcomeEmail } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  let startInfo = "";
  let contractAttachment: EmailAttachment | undefined;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    startInfo = (form.get("startInfo") as string | null) ?? "";
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
      contractAttachment = {
        filename: file.name,
        content: buffer,
        contentType: file.type,
      };
    }
  } else {
    const body = await request.json().catch(() => ({}));
    startInfo = typeof body.startInfo === "string" ? body.startInfo : "";
  }

  try {
    await sendCandidateWelcomeEmail(id, startInfo, admin.id, contractAttachment);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hiringErrorResponse(err, "Could not send welcome email");
  }
}
