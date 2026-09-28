import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  deleteHarvest,
  updateHarvest,
  type HarvestDestination,
} from "@/lib/db/farm";

const DESTINATIONS: HarvestDestination[] = [
  "kitchen",
  "sold",
  "seed_stock",
  "waste",
  "other",
];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
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

  if (body.destination && !DESTINATIONS.includes(body.destination)) {
    return NextResponse.json({ error: "invalid destination" }, { status: 400 });
  }
  if (
    body.quantityKg != null &&
    (!Number.isFinite(body.quantityKg) || body.quantityKg <= 0)
  ) {
    return NextResponse.json({ error: "invalid quantity" }, { status: 400 });
  }

  const outcome = await updateHarvest(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ harvest: outcome.harvest });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteHarvest(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
