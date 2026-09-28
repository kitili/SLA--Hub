import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

const SHEET_ID =
  process.env.GOOGLE_SHEETS_HIRING_FORM_ID ||
  "1CgixRZWX0lcCXx_DMZZgXCnkMn2m0s354XFvU6Atvyo";

/**
 * GET /api/admin/hiring/sheet-debug
 *
 * Reads the raw sheet and returns:
 *  - header row (row 1) so we can verify column order
 *  - total row count
 *  - unique values found in each column suspected to be roleApplied (cols 10-16)
 *
 * Admin-only. Use this to diagnose column-mapping issues.
 */
export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not set" }, { status: 500 });

  const creds = JSON.parse(raw);
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  // Fetch header row separately
  const headerRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A1:Z1",
  });
  const header: string[] = ((headerRes.data.values?.[0] ?? []) as string[]).map(
    (h, i) => `[${i}] ${h}`,
  );

  // Fetch all data rows
  const dataRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A2:Z",
  });
  const rows = (dataRes.data.values ?? []) as string[][];

  // For columns 10–16 collect unique non-empty values (likely role column area)
  const roleColumnSamples: Record<string, string[]> = {};
  for (let col = 10; col <= 16; col++) {
    const unique = new Set<string>();
    for (const row of rows) {
      const val = (row[col] ?? "").trim();
      if (val) unique.add(val);
    }
    roleColumnSamples[`col_${col}`] = [...unique].slice(0, 30);
  }

  // Also show rows where email or fullName is blank (these are silently skipped)
  const missingEmailOrName = rows.filter(
    (r) => !(r[1] ?? "").trim() || !(r[2] ?? "").trim(),
  ).length;

  return NextResponse.json({
    totalRows: rows.length,
    header,
    missingEmailOrName,
    roleColumnSamples,
  });
}
