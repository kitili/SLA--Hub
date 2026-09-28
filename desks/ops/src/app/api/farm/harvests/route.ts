import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createHarvest,
  listHarvests,
  type HarvestDestination,
} from "@/lib/db/farm";

const DESTINATIONS: HarvestDestination[] = [
  "kitchen",
  "sold",
  "seed_stock",
  "waste",
  "other",
];

/**
 * GET  /api/farm/harvests?plotId= — admin/finance
 * POST /api/farm/harvests — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const plotId = new URL(request.url).searchParams.get("plotId") ?? undefined;
  const harvests = await listHarvests({ plotId: plotId ?? undefined });
  return NextResponse.json({ harvests });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    plotId?: string;
    plantingId?: string | null;
    harvestedOn?: string;
    quantityKg?: number;
    valueAmount?: number | null;
    currency?: string;
    destination?: HarvestDestination;
    photoUrl?: string | null;
    notes?: string | null;
  };

  if (!body.plotId?.trim() || !body.quantityKg || body.quantityKg <= 0) {
    return NextResponse.json(
      { error: "plotId and a positive quantityKg are required" },
      { status: 400 },
    );
  }

  if (body.destination && !DESTINATIONS.includes(body.destination)) {
    return NextResponse.json({ error: "invalid destination" }, { status: 400 });
  }

  const outcome = await createHarvest({
    plotId: body.plotId,
    plantingId: body.plantingId ?? null,
    harvestedOn: body.harvestedOn,
    quantityKg: body.quantityKg,
    valueAmount: body.valueAmount ?? null,
    currency: body.currency,
    destination: body.destination,
    photoUrl: body.photoUrl ?? null,
    notes: body.notes ?? null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ harvest: outcome.harvest }, { status: 201 });
}
