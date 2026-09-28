import { NextRequest, NextResponse } from "next/server";
import { sendWeeklySystemsReports } from "@/lib/reports/weekly-systems-report";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklySystemsReports();
  return NextResponse.json({ ok: true, ...result });
}
