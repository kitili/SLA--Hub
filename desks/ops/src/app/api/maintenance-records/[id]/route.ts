import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteMaintenance } from "@/lib/db/maintenance";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/maintenance-records/:id — admin / finance
 * Alias path matching Jfree backlog naming; same as /api/maintenance/[id].
 */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteMaintenance(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
