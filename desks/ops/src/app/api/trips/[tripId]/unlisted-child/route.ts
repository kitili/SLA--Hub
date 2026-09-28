import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { logUnlistedChildScan } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * POST /api/trips/[tripId]/unlisted-child — matron logs a child who
 * boarded but isn't in the system yet (new student, or a master-sheet
 * gap). Body: { name, notes? }
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  const body = (await request.json()) as { name?: string; notes?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Child's name is required" }, { status: 400 });
  }

  const outcome = await logUnlistedChildScan({
    tripId,
    childName: body.name,
    notes: body.notes ?? null,
    reportedBy: auth.userId,
  });

  if ("error" in outcome) {
    const status = outcome.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: outcome.error }, { status });
  }

  return NextResponse.json({ incident: outcome.incident }, { status: 201 });
}
