import { NextRequest, NextResponse } from "next/server";
import { getVisitService } from "@/lib/container";
import { jsonError } from "@/lib/http";
import { VisitCsvExporter } from "@/services/VisitCsvExporter";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const campus = searchParams.get("campus") || undefined;
    const date = searchParams.get("date") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const source = searchParams.get("source") as "desk" | "self" | null;

    const visits = await getVisitService().list({
      campus,
      date,
      dateFrom,
      dateTo,
      source: source === "desk" || source === "self" ? source : undefined,
    });
    const csv = new VisitCsvExporter().export(visits);
    const filename = `visitor-log-${(campus || "all").replace(/\s+/g, "-").toLowerCase()}-${date || "all"}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
