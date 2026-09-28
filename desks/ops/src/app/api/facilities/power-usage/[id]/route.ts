import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deletePowerUsage, updatePowerUsage } from "@/lib/db/facilities";

/** PATCH /api/facilities/power-usage/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    readingDate?: string;
    unitsReceived?: number | null;
    unitsSpent?: number | null;
    balanceUnits?: number | null;
  };

  const outcome = await updatePowerUsage(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ entry: outcome.entry });
}

/** DELETE /api/facilities/power-usage/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deletePowerUsage(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
