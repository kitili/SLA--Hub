import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteBus, updateBus } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/buses/:id — admin only
 * Body: { schoolId?, label?, plateNumber?, capacity?, driverName?, attendantName?, ownerName?, routeId? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    schoolId?: string;
    label?: string;
    plateNumber?: string;
    capacity?: number;
    registeredCapacity?: number | null;
    driverName?: string | null;
    attendantName?: string | null;
    ownerName?: string | null;
    routeId?: string | null;
  };

  if (
    body.capacity !== undefined &&
    (!Number.isInteger(body.capacity) || body.capacity <= 0)
  ) {
    return NextResponse.json(
      { error: "capacity must be a whole number greater than 0" },
      { status: 400 },
    );
  }
  if (
    body.registeredCapacity !== undefined &&
    body.registeredCapacity !== null &&
    (!Number.isInteger(body.registeredCapacity) || body.registeredCapacity <= 0)
  ) {
    return NextResponse.json(
      { error: "registeredCapacity must be a whole number greater than 0" },
      { status: 400 },
    );
  }

  const outcome = await updateBus(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}

/**
 * DELETE /api/buses/:id — admin only
 * Cascades trips / boarding / maintenance via FK.
 */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteBus(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
