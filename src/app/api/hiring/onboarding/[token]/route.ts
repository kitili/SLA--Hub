import { NextResponse } from "next/server";

import { runWithRls } from "@/lib/db/rls";
import { onboardingSubmitSchema } from "@/lib/hiring/admin-schemas";
import { hiringErrorResponse } from "@/lib/hiring/http";
import {
  submitItOnboarding,
  validateOnboardingToken,
} from "@/lib/hiring/pipeline";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  if (!token || token.length > 80) {
    return NextResponse.json(
      { error: "This link is invalid, expired, or has already been used." },
      { status: 404 },
    );
  }
  return runWithRls({ hiringToken: token }, async () => {
    const info = await validateOnboardingToken(token).catch(() => null);
    if (!info) {
      return NextResponse.json(
        { error: "This link is invalid, expired, or has already been used." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      candidateName: info.candidateName,
      role: info.role,
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!token || token.length > 80) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding details" }, { status: 400 });
  }

  try {
    await runWithRls({ hiringToken: token }, () =>
      submitItOnboarding(
        token,
        parsed.data.workEmail,
        parsed.data.tempPassword,
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hiringErrorResponse(err, "Could not submit onboarding");
  }
}
