import { NextResponse } from "next/server";
import { checkDriverComplianceAlerts } from "@/lib/compliance/check-driver-alerts";

/**
 * GET|POST /api/cron/driver-compliance
 * SMS admin + driver ~7 days before licence / PSV / insurance / medical / service renewal.
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
    const { raised } = await checkDriverComplianceAlerts();
    return NextResponse.json({
      ok: true,
      raised_count: raised.length,
      raised,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Driver compliance check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
