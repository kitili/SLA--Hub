import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { verifyGuardianForBoardingEvent } from "@/lib/db/queries";

/**
 * POST /api/boarding/verify-guardian
 * Body: { boardingEventId, code }
 * Scanned right after a student's alighting ("out") scan at evening
 * drop-off, to confirm the physically-present adult is an authorized
 * guardian for that specific student — not just that the child got off.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    boardingEventId?: string;
    code?: string;
  };

  if (!body.boardingEventId?.trim() || !body.code?.trim()) {
    return NextResponse.json(
      { error: "Fields `boardingEventId` and `code` are required" },
      { status: 400 },
    );
  }

  const result = await verifyGuardianForBoardingEvent({
    boardingEventId: body.boardingEventId.trim(),
    code: body.code.trim(),
    scannedBy: auth.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
