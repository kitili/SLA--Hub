import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  deleteCropPlanting,
  updateCropPlanting,
  type PlantingStatus,
} from "@/lib/db/farm";

const STATUSES: PlantingStatus[] = [
  "planned",
  "planted",
  "growing",
  "harvested",
  "failed",
];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    status?: PlantingStatus;
    plantedOn?: string | null;
    expectedHarvestOn?: string | null;
    targetYieldKg?: number | null;
    notes?: string | null;
  };

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await updateCropPlanting(id, {
    status: body.status,
    plantedOn: body.plantedOn,
    expectedHarvestOn: body.expectedHarvestOn,
    targetYieldKg: body.targetYieldKg,
    notes: body.notes,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ planting: outcome.planting });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteCropPlanting(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
