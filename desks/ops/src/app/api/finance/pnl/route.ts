import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getPeriodPnL } from "@/lib/db/finance";

/**
 * GET /api/finance/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD&schoolId=
 * Day 14 — period P&L + budget vs actual burn.
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 },
    );
  }

  const report = await getPeriodPnL({
    from,
    to,
    schoolId: searchParams.get("schoolId") ?? undefined,
  });

  return NextResponse.json({ pnl: report });
}
