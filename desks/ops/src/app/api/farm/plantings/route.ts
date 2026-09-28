import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createCropPlanting,
  listCropPlantings,
  type PlantingStatus,
} from "@/lib/db/farm";

const STATUSES: PlantingStatus[] = [
  "planned",
  "planted",
  "growing",
  "harvested",
  "failed",
];

/**
 * GET  /api/farm/plantings?plotId= — admin/finance
 * POST /api/farm/plantings — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const plotId = new URL(request.url).searchParams.get("plotId") ?? undefined;
  const plantings = await listCropPlantings({ plotId: plotId ?? undefined });
  return NextResponse.json({ plantings });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    plotId?: string;
    crop?: string;
    season?: string | null;
    plantedOn?: string | null;
    expectedHarvestOn?: string | null;
    targetYieldKg?: number | null;
    status?: PlantingStatus;
    notes?: string | null;
  };

  if (!body.plotId?.trim() || !body.crop?.trim()) {
    return NextResponse.json(
      { error: "plotId and crop are required" },
      { status: 400 },
    );
  }

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await createCropPlanting({
    plotId: body.plotId,
    crop: body.crop,
    season: body.season ?? null,
    plantedOn: body.plantedOn ?? null,
    expectedHarvestOn: body.expectedHarvestOn ?? null,
    targetYieldKg: body.targetYieldKg ?? null,
    status: body.status,
    notes: body.notes ?? null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ planting: outcome.planting }, { status: 201 });
}
