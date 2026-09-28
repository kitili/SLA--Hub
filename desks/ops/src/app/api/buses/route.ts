import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createBus, getBuses } from "@/lib/db/queries";

export async function GET() {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const buses = await getBuses();
  return NextResponse.json({ buses });
}

/**
 * POST /api/buses — admin only
 * Body: { schoolId, label, plateNumber, capacity?, driverId?, driverName?, attendantName?, ownerName?, routeId? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    label?: string;
    plateNumber?: string;
    capacity?: number;
    registeredCapacity?: number | null;
    driverId?: string;
    driverName?: string;
    attendantName?: string;
    ownerName?: string;
    routeId?: string;
  };

  if (!body.schoolId?.trim() || !body.label?.trim() || !body.plateNumber?.trim()) {
    return NextResponse.json(
      { error: "schoolId, label, plateNumber are required" },
      { status: 400 },
    );
  }
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

  const outcome = await createBus({
    schoolId: body.schoolId.trim(),
    label: body.label.trim(),
    plateNumber: body.plateNumber.trim(),
    capacity: body.capacity,
    registeredCapacity: body.registeredCapacity ?? null,
    driverId: body.driverId?.trim() || null,
    driverName: body.driverName?.trim() || null,
    attendantName: body.attendantName?.trim() || null,
    ownerName: body.ownerName?.trim() || null,
    routeId: body.routeId?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
