import { NextResponse } from "next/server";
import { checkFarmAlerts } from "@/lib/db/farm";

/**
 * GET|POST /api/cron/farm-alerts
 * Raises overdue-activity / low-stock / budget-overrun alerts and SMS-notifies
 * admin via notifyAdminSms. Dedup enforced by farm_alerts partial unique indexes.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { raised } = await checkFarmAlerts();
    return NextResponse.json({ ok: true, raised_count: raised.length, raised });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Farm alert check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
