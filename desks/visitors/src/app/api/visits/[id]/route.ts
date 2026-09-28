import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getVisitService } from "@/lib/container";

export const runtime = "nodejs";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const visit = await getVisitService().signOut(id);
    return NextResponse.json({ visit });
  } catch (error) {
    return jsonError(error);
  }
}
