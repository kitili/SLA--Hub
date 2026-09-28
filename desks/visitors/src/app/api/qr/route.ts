import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCheckInUrl } from "@/lib/app-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? undefined;
  const url = getCheckInUrl(host);
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#002368", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Check-In-Url": url,
    },
  });
}
