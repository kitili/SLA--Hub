import { NextResponse } from "next/server";
import { loadDefaultFeeCsv, syncFeesFromCsv } from "@/lib/fees/sync-fees";

/**
 * GET|POST /api/cron/sync-fees
 * Day 15: production-ready fee sync (CSV → fee_balances). EdAdmin adapter later.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Body (optional JSON): { csv?, source?, dryRun?: boolean }
 * Query: ?dryRun=1
 * Without body.csv, loads data/fees/sample-fee-balances.csv
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

  const url = new URL(request.url);
  let csv: string | undefined;
  let source = "csv";
  let dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dry_run") === "1";

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        csv?: string;
        source?: string;
        dryRun?: boolean;
        dry_run?: boolean;
      };
      csv = body.csv;
      if (body.source?.trim()) source = body.source.trim();
      if (body.dryRun === true || body.dry_run === true) dryRun = true;
    } else if (contentType.includes("text/csv")) {
      csv = await request.text();
      source = "csv-upload";
    }
  }

  if (!csv?.trim()) {
    try {
      csv = await loadDefaultFeeCsv();
      source = source === "csv" ? "sample-csv" : source;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load default fee CSV";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const started = Date.now();
  try {
    const result = await syncFeesFromCsv({ csv, source, dryRun });
    return NextResponse.json({
      ok: result.run.status === "success",
      dry_run: dryRun,
      duration_ms: Date.now() - started,
      run: result.run,
      upserted: result.upserted,
      skipped: result.skipped,
      parseErrors: result.parseErrors.slice(0, 20),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fee sync failed";
    const status = message.includes("already running") ? 409 : 500;
    return NextResponse.json(
      { error: message, duration_ms: Date.now() - started },
      { status },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
