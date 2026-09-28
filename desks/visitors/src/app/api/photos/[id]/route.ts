import { NextRequest, NextResponse } from "next/server";
import { getPhotoStorage } from "@/lib/container";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const buffer = await getPhotoStorage().read(safeId);
  if (!buffer) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
