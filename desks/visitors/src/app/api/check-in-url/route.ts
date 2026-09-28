import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, getCheckInUrl, getNetworkIps, getPublicBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? undefined;
  const publicBase = getPublicBaseUrl(host);
  const isPublic = !publicBase.includes("localhost") && !publicBase.match(/192\.168\.|172\.(1[6-9]|2\d|3[01])\.|10\./);

  return NextResponse.json({
    url: getCheckInUrl(host),
    base: getAppBaseUrl(host),
    publicBase,
    isPublic,
    networkIps: getNetworkIps(),
  });
}
