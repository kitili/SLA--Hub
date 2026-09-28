import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getVisitService } from "@/lib/container";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const campus = request.nextUrl.searchParams.get("campus") || undefined;
    const date = request.nextUrl.searchParams.get("date") || undefined;
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") || undefined;
    const dateTo = request.nextUrl.searchParams.get("dateTo") || undefined;
    const onSiteOnly = request.nextUrl.searchParams.get("onSite") === "1";
    const signedOutOnly = request.nextUrl.searchParams.get("signedOut") === "1";
    const source = request.nextUrl.searchParams.get("source") as "desk" | "self" | null;

    const visits = await getVisitService().list({
      campus,
      date,
      dateFrom,
      dateTo,
      onSiteOnly,
      signedOutOnly,
      source: source === "desk" || source === "self" ? source : undefined,
    });
    return NextResponse.json({ visits });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const visit = await getVisitService().signIn({
      name: String(body.name ?? ""),
      phone: String(body.phone ?? ""),
      purpose: String(body.purpose ?? ""),
      host: String(body.host ?? ""),
      campus: String(body.campus ?? ""),
      photo: body.photo ?? null,
      source: body.source === "self" ? "self" : "desk",
    });
    return NextResponse.json({ visit }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
