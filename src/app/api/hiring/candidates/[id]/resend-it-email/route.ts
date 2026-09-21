import { NextResponse } from "next/server";

import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import { resendItOnboardingEmail } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  try {
    await resendItOnboardingEmail(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hiringErrorResponse(err, "Could not resend IT email");
  }
}
