import { NextResponse } from "next/server";

import { hiringErrorResponse } from "@/lib/hiring/http";
import { importCandidatesFromCsv } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

const MAX_CSV_BYTES = 1_000_000;
const MAX_ERROR_MESSAGES = 20;

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let csvText = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    csvText = String(body?.csv || body?.text || "");
  } else {
    csvText = await request.text();
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }
  if (csvText.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "CSV is too large" }, { status: 400 });
  }

  try {
    const result = await importCandidatesFromCsv(csvText);
    return NextResponse.json({
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.slice(0, MAX_ERROR_MESSAGES),
    });
  } catch (err) {
    return hiringErrorResponse(err, "Could not import candidates");
  }
}
