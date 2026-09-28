import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createInput, listInputs } from "@/lib/db/farm";

/**
 * GET  /api/farm/inputs — admin/finance
 * POST /api/farm/inputs — admin/finance
 */
export async function GET() {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const inputs = await listInputs();
  return NextResponse.json({ inputs });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    name?: string;
    unit?: string;
    quantityOnHand?: number;
    reorderThreshold?: number;
    notes?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createInput({
    name: body.name.trim(),
    unit: body.unit,
    quantityOnHand: body.quantityOnHand,
    reorderThreshold: body.reorderThreshold,
    notes: body.notes,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ input: outcome.input }, { status: 201 });
}
