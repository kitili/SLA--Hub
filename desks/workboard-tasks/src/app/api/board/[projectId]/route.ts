import { NextRequest, NextResponse } from "next/server";
import { getBoardData } from "@/lib/data/board";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const data = await getBoardData(projectId);

  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
