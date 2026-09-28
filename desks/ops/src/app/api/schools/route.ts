import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createSchool } from "@/lib/db/queries";
import { FACILITIES_ROLES } from "@/lib/facilities-access";

/**
 * POST /api/schools — admin/transport/facilities roles (schools are shared
 * across every domain, so anyone who manages a domain scoped by campus can
 * add one)
 * Body: { name, slug? } — slug auto-derived from name when omitted.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", ...FACILITIES_ROLES]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { name?: string; slug?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createSchool({ name: body.name, slug: body.slug });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
