import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { voidBoardingEvent } from "@/lib/db/queries";

type Ctx = { params: Promise<{ eventId: string }> };

/**
 * POST /api/boarding/[eventId]/void — matron undoes a mis-scan (wrong
 * student, scanned by accident). Soft-voids the row; see voidBoardingEvent()
 * for why it isn't a hard delete.
 */
export async function POST(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const outcome = await voidBoardingEvent({
    eventId,
    voidedBy: auth.userId,
  });

  if ("error" in outcome) {
    const status = outcome.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: outcome.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
