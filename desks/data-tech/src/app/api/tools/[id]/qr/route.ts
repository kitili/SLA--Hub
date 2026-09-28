import { NextResponse } from "next/server";
import { requireModule } from "@/lib/rbac";
import { generateToolQrPngBuffer } from "@/lib/qrcode";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const { id } = await params;
  const buffer = await generateToolQrPngBuffer(id);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
