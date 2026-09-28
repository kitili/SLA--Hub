import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteSchool, updateSchool } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/schools/:id — admin only
 * Body: { name?, slug? }. Slug is deliberately not surfaced in the admin UI —
 * see CAMPUS_QR_PREFIX in queries.ts, changing it can break QR code prefixes.
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as { name?: string; slug?: string };
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      { error: "Campus name is required" },
      { status: 400 },
    );
  }

  const outcome = await updateSchool(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  return NextResponse.json(outcome);
}

/**
 * DELETE /api/schools/:id — admin only
 * Refuses if campus still has students/buses unless ?force=1
 */
export async function DELETE(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true";

  const outcome = await deleteSchool(id, { force });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
