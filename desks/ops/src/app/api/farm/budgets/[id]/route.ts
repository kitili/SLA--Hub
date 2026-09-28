import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteFarmBudget } from "@/lib/db/farm";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteFarmBudget(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
